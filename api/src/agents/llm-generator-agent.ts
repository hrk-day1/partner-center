import crypto from "node:crypto";
import { z } from "zod";
import type { ChecklistItem, Domain, TestCase } from "../types/tc.js";
import { DOMAINS, TC_TYPES } from "../types/tc.js";
import type { SkillManifest } from "../skills/types.js";
import { generateJson } from "../llm/gemini-client.js";
import { buildGeneratorPrompt } from "../llm/prompts/generator-prompt.js";
import { generateTestCases } from "../pipeline/generator.js";
import type { Agent } from "./registry.js";
import type { AgentResult, SubAgentConfig } from "./types.js";
import type { eventBus } from "./event-bus.js";
import type { GeneratorInput } from "./deterministic-generator-agent.js";

const TestCaseSchema = z.array(
  z.object({
    TC_ID: z.string(),
    Feature: z.string(),
    Requirement_ID: z.string(),
    Scenario: z.string(),
    Precondition: z.string(),
    Test_Steps: z.string(),
    Test_Data: z.string(),
    Expected_Result: z.string(),
    Priority: z.enum(["P0", "P1", "P2"]),
    Severity: z.enum(["S1", "S2", "S3"]),
    Type: z.enum(TC_TYPES as unknown as [string, ...string[]]),
    Environment: z.string(),
    Owner: z.string(),
    Status: z.string(),
    Automation_Candidate: z.string(),
    Traceability: z.string(),
    Notes: z.string(),
  }),
);

function groupByDomain(items: ChecklistItem[]): Map<Domain, ChecklistItem[]> {
  const groups = new Map<Domain, ChecklistItem[]>();
  for (const item of items) {
    const list = groups.get(item.domain) ?? [];
    list.push(item);
    groups.set(item.domain, list);
  }
  return groups;
}

const CHUNK_SIZE = 15;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export class LlmGeneratorAgent implements Agent<GeneratorInput, TestCase[]> {
  readonly type = "generator" as const;

  async run(
    input: GeneratorInput,
    bus: typeof eventBus,
    config: SubAgentConfig,
  ): Promise<AgentResult<TestCase[]>> {
    const agentId = `gen-llm-${crypto.randomUUID().slice(0, 6)}`;
    const start = Date.now();

    bus.emit(config.pipelineId, {
      agentId, agentType: "generator", status: "running", progress: 0,
      message: `LLM TC 생성 시작 (${input.checklist.length}건)...`,
      timestamp: new Date().toISOString(),
    });

    try {
      const domainGroups = groupByDomain(input.checklist);
      const allTcs: TestCase[] = [];
      let tcCounter = 1;
      let completedDomains = 0;
      const totalDomains = domainGroups.size;

      const domainPromises = [...domainGroups.entries()].map(
        async ([domain, items]) => {
          const chunks = chunkArray(items, CHUNK_SIZE);
          const domainTcs: TestCase[] = [];

          for (const chunk of chunks) {
            const prompt = buildGeneratorPrompt(
              chunk, domain, input.skill, input.config, tcCounter,
            );

            const { data: tcs } = await generateJson(prompt, TestCaseSchema);

            for (const tc of tcs) {
              tc.TC_ID = `TC-${String(tcCounter++).padStart(4, "0")}`;
            }

            domainTcs.push(...(tcs as TestCase[]));
          }

          completedDomains++;
          const progress = Math.round((completedDomains / totalDomains) * 90);

          bus.emit(config.pipelineId, {
            agentId, agentType: "generator", status: "running", progress,
            message: `${domain} 도메인 완료 (${domainTcs.length}건)`,
            timestamp: new Date().toISOString(),
          });

          return domainTcs;
        },
      );

      const results = await Promise.all(domainPromises);
      let finalCounter = 1;
      for (const domainTcs of results) {
        for (const tc of domainTcs) {
          tc.TC_ID = `TC-${String(finalCounter++).padStart(4, "0")}`;
          allTcs.push(tc);
        }
      }

      bus.emit(config.pipelineId, {
        agentId, agentType: "generator", status: "completed", progress: 100,
        message: `LLM TC ${allTcs.length}건 생성 완료`,
        timestamp: new Date().toISOString(),
      });

      return {
        agentId, agentType: "generator", status: "completed",
        data: allTcs, durationMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn(`[llm-gen] failed, falling back to deterministic: ${message}`);

      bus.emit(config.pipelineId, {
        agentId, agentType: "generator", status: "running", progress: 50,
        message: "LLM 실패, 템플릿 기반 폴백 실행 중...",
        timestamp: new Date().toISOString(),
      });

      try {
        const testCases = generateTestCases(input.checklist, input.config, input.skill);

        bus.emit(config.pipelineId, {
          agentId, agentType: "generator", status: "completed", progress: 100,
          message: `폴백 TC ${testCases.length}건 생성 완료`,
          timestamp: new Date().toISOString(),
        });

        return {
          agentId, agentType: "generator", status: "completed",
          data: testCases, durationMs: Date.now() - start,
        };
      } catch (fbErr) {
        const fbMsg = fbErr instanceof Error ? fbErr.message : "Unknown error";
        bus.emit(config.pipelineId, {
          agentId, agentType: "generator", status: "failed", progress: 0,
          message: fbMsg, timestamp: new Date().toISOString(),
        });
        return {
          agentId, agentType: "generator", status: "failed",
          data: null, error: fbMsg, durationMs: Date.now() - start,
        };
      }
    }
  }
}
