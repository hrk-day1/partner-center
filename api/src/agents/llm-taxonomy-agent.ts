import crypto from "node:crypto";
import { z } from "zod";
import { TC_TYPES } from "../types/tc.js";
import type { TcType } from "../types/tc.js";
import type { SkillManifest } from "../skills/types.js";
import { generateJson } from "../llm/gemini-client.js";
import { buildTaxonomyPrompt } from "../llm/prompts/taxonomy-prompt.js";
import { mergeTaxonomyIntoResolved, type ResolvedSkill } from "../skills/resolved-skill.js";
import type { eventBus } from "./event-bus.js";

const TcTypeEnum = z.enum(TC_TYPES as unknown as [string, ...string[]]);

const TcTemplateSchema = z.object({
  type: TcTypeEnum,
  scenarioSuffix: z.string().max(512),
  precondition: z.string().max(2000),
  steps: z.string().max(8000),
  expectedResult: z.string().max(2000),
});

const TaxonomyLlmResultSchema = z.object({
  domains: z.array(
    z.object({
      id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/),
      keywords: z.array(z.string().min(1).max(120)).min(1).max(40),
      minSets: z.record(TcTypeEnum, z.number().int().min(0).max(25)).optional(),
      templates: z.array(TcTemplateSchema).min(1).max(12),
    }),
  ).min(1).max(12),
});

export interface TaxonomyPhaseInput {
  headers: string[];
  sampleRows: string[][];
  sourceSheetName: string;
  baseSkill: SkillManifest;
}

export async function runTaxonomyPhase(
  input: TaxonomyPhaseInput,
  bus: typeof eventBus,
  pipelineId: string,
): Promise<ResolvedSkill> {
  const agentId = `tax-llm-${crypto.randomUUID().slice(0, 6)}`;
  const start = Date.now();

  bus.emit(pipelineId, {
    agentId,
    agentType: "taxonomy",
    status: "running",
    progress: 0,
    message: "분류 체계(Taxonomy) LLM 분석 중...",
    timestamp: new Date().toISOString(),
  });

  const prompt = buildTaxonomyPrompt(
    input.headers,
    input.sampleRows,
    input.sourceSheetName,
    input.baseSkill,
  );

  bus.emit(pipelineId, {
    agentId,
    agentType: "taxonomy",
    status: "running",
    progress: 40,
    message: "Gemini로 Taxonomy 생성 중...",
    timestamp: new Date().toISOString(),
  });

  const { data, usage } = await generateJson(prompt, TaxonomyLlmResultSchema);
  const resolved = mergeTaxonomyIntoResolved(input.baseSkill, {
    domains: data.domains.map((d) => ({
      ...d,
      templates: d.templates.map((t) => ({ ...t, type: t.type as TcType })),
    })),
  });

  bus.emit(pipelineId, {
    agentId,
    agentType: "taxonomy",
    status: "completed",
    progress: 100,
    message: `Taxonomy 완료: ${resolved.domainOrder.length}개 도메인 (tokens: ${usage.totalTokens})`,
    timestamp: new Date().toISOString(),
    payload: { usage, domainOrder: [...resolved.domainOrder] },
  });

  console.log(`[taxonomy] ${pipelineId} domains=${resolved.domainOrder.join(",")} ${Date.now() - start}ms`);

  return resolved;
}
