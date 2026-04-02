import crypto from "node:crypto";
import { z } from "zod";
import type { ChecklistItem, TestCase } from "../types/tc.js";
import { TC_TYPES } from "../types/tc.js";
import type { EvaluationResult } from "../types/pipeline.js";
import type { SkillManifest } from "../skills/types.js";
import { evaluate } from "../pipeline/evaluator.js";
import { generateJson } from "../llm/gemini-client.js";
import { buildRepairPrompt } from "../llm/prompts/evaluator-prompt.js";
import type { Agent } from "./registry.js";
import type { AgentResult, SubAgentConfig } from "./types.js";
import type { eventBus } from "./event-bus.js";
import type { EvaluatorInput } from "./deterministic-evaluator-agent.js";

const MAX_REPAIR_ROUNDS = 2;

const RepairResponseSchema = z.object({
  newTestCases: z.array(
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
  ),
  repairNotes: z.string(),
});

export class LlmEvaluatorAgent implements Agent<EvaluatorInput, EvaluationResult> {
  readonly type = "evaluator" as const;

  async run(
    input: EvaluatorInput,
    bus: typeof eventBus,
    config: SubAgentConfig,
  ): Promise<AgentResult<EvaluationResult>> {
    const agentId = `eval-llm-${crypto.randomUUID().slice(0, 6)}`;
    const start = Date.now();
    let allTcs = [...input.testCases];

    bus.emit(config.pipelineId, {
      agentId, agentType: "evaluator", status: "running", progress: 0,
      message: "규칙 게이트 검증 중...", timestamp: new Date().toISOString(),
    });

    try {
      let evalResult = evaluate(input.checklist, allTcs, input.skill);
      let round = 0;

      while (
        !evalResult.passed &&
        evalResult.uncoveredItems.length > 0 &&
        round < MAX_REPAIR_ROUNDS
      ) {
        round++;
        const progress = Math.round((round / (MAX_REPAIR_ROUNDS + 1)) * 80);

        bus.emit(config.pipelineId, {
          agentId, agentType: "evaluator", status: "running", progress,
          message: `LLM 수정 라운드 ${round}/${MAX_REPAIR_ROUNDS}...`,
          timestamp: new Date().toISOString(),
        });

        const nextTcId = allTcs.length + 1;
        const prompt = buildRepairPrompt(
          evalResult.issues,
          evalResult.uncoveredItems,
          allTcs,
          input.skill,
          input.config,
          nextTcId,
        );

        const { data: repairResult } = await generateJson(prompt, RepairResponseSchema);

        if (repairResult.newTestCases.length > 0) {
          allTcs = [...allTcs, ...(repairResult.newTestCases as TestCase[])];
          console.log(`[llm-eval] repair round ${round}: +${repairResult.newTestCases.length} TCs, note: ${repairResult.repairNotes}`);
        }

        evalResult = evaluate(input.checklist, allTcs, input.skill);
      }

      bus.emit(config.pipelineId, {
        agentId, agentType: "evaluator", status: "completed", progress: 100,
        message: `검증 완료: ${evalResult.passed ? "통과" : `이슈 ${evalResult.issues.length}건`} (repair ${round}회)`,
        timestamp: new Date().toISOString(),
        payload: { repairRounds: round, finalTcCount: allTcs.length },
      });

      (evalResult as EvaluationResult & { repairedTestCases?: TestCase[] }).repairedTestCases = allTcs;

      return {
        agentId, agentType: "evaluator", status: "completed",
        data: evalResult, durationMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn(`[llm-eval] LLM repair failed, returning rule-only result: ${message}`);

      const evalResult = evaluate(input.checklist, allTcs, input.skill);

      bus.emit(config.pipelineId, {
        agentId, agentType: "evaluator", status: "completed", progress: 100,
        message: `규칙 검증만 완료 (LLM repair 실패): 이슈 ${evalResult.issues.length}건`,
        timestamp: new Date().toISOString(),
      });

      return {
        agentId, agentType: "evaluator", status: "completed",
        data: evalResult, durationMs: Date.now() - start,
      };
    }
  }
}
