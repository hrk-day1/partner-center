import crypto from "node:crypto";
import { z } from "zod";
import type { ChecklistItem, Domain } from "../types/tc.js";
import { DOMAINS } from "../types/tc.js";
import type { SkillManifest } from "../skills/types.js";
import { generateJson } from "../llm/gemini-client.js";
import { buildPlanPrompt } from "../llm/prompts/plan-prompt.js";
import { detectHeaderAndData, buildChecklist } from "../pipeline/plan.js";
import type { Agent } from "./registry.js";
import type { AgentResult, SubAgentConfig } from "./types.js";
import type { eventBus } from "./event-bus.js";
import type { PlanInput } from "./deterministic-plan-agent.js";

const ChecklistItemSchema = z.array(
  z.object({
    id: z.string(),
    requirementId: z.string(),
    feature: z.string(),
    domain: z.enum(DOMAINS as unknown as [string, ...string[]]) as z.ZodType<Domain>,
    description: z.string(),
    sourceRow: z.number(),
    sourceSheet: z.string(),
    covered: z.boolean(),
  }),
);

export class LlmPlanAgent implements Agent<PlanInput, ChecklistItem[]> {
  readonly type = "plan" as const;

  async run(
    input: PlanInput,
    bus: typeof eventBus,
    config: SubAgentConfig,
  ): Promise<AgentResult<ChecklistItem[]>> {
    const agentId = `plan-llm-${crypto.randomUUID().slice(0, 6)}`;
    const start = Date.now();

    bus.emit(config.pipelineId, {
      agentId, agentType: "plan", status: "running", progress: 0,
      message: "LLM으로 시트 분석 중...", timestamp: new Date().toISOString(),
    });

    try {
      const { headers, dataRows } = detectHeaderAndData(input.raw);

      bus.emit(config.pipelineId, {
        agentId, agentType: "plan", status: "running", progress: 30,
        message: "LLM 프롬프트 구성 중...", timestamp: new Date().toISOString(),
      });

      const prompt = buildPlanPrompt(headers, dataRows, input.sourceSheetName, input.skill);

      bus.emit(config.pipelineId, {
        agentId, agentType: "plan", status: "running", progress: 50,
        message: "Gemini API 호출 중...", timestamp: new Date().toISOString(),
      });

      const { data: checklist, usage } = await generateJson(prompt, ChecklistItemSchema);

      bus.emit(config.pipelineId, {
        agentId, agentType: "plan", status: "completed", progress: 100,
        message: `LLM 체크리스트 ${checklist.length}건 완료 (tokens: ${usage.totalTokens})`,
        timestamp: new Date().toISOString(),
        payload: { usage },
      });

      return {
        agentId, agentType: "plan", status: "completed",
        data: checklist, durationMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn(`[llm-plan] failed, falling back to deterministic: ${message}`);

      bus.emit(config.pipelineId, {
        agentId, agentType: "plan", status: "running", progress: 70,
        message: "LLM 실패, 규칙 기반 폴백 실행 중...", timestamp: new Date().toISOString(),
      });

      try {
        const { headers, dataRows, headerRowIndex } = detectHeaderAndData(input.raw);
        const checklist = buildChecklist(
          headers, dataRows, input.sourceSheetName, headerRowIndex, input.skill,
        );

        bus.emit(config.pipelineId, {
          agentId, agentType: "plan", status: "completed", progress: 100,
          message: `폴백 체크리스트 ${checklist.length}건 완료`,
          timestamp: new Date().toISOString(),
        });

        return {
          agentId, agentType: "plan", status: "completed",
          data: checklist, durationMs: Date.now() - start,
        };
      } catch (fallbackErr) {
        const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : "Unknown error";
        bus.emit(config.pipelineId, {
          agentId, agentType: "plan", status: "failed", progress: 0,
          message: fbMsg, timestamp: new Date().toISOString(),
        });
        return {
          agentId, agentType: "plan", status: "failed",
          data: null, error: fbMsg, durationMs: Date.now() - start,
        };
      }
    }
  }
}
