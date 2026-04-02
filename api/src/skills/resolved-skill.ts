import type { TcType } from "../types/tc.js";
import { DOMAINS, TC_TYPES } from "../types/tc.js";
import type { SkillManifest, TcTemplate } from "./types.js";

export interface ResolvedPriorityRule {
  domain: string;
  types: TcType[];
  priority: "P0" | "P1" | "P2";
}

export interface ResolvedSeverityRule {
  domain: string;
  types: TcType[];
  severity: "S1" | "S2" | "S3";
}

/** 런타임 스킬: preset JSON 또는 Taxonomy 결과를 문자열 도메인 키로 통일 */
export interface ResolvedSkill {
  id: string;
  name: string;
  description: string;
  /** 프롬프트·추론 순서 (Taxonomy 출력 순서 또는 preset DOMAINS 순서) */
  domainOrder: readonly string[];
  /** 키워드 미매칭 시 Plan/Evaluator 기본 도메인 */
  fallbackDomain: string;
  domainKeywords: Record<string, string[]>;
  templates: Record<string, TcTemplate[]>;
  domainMinSets: Record<string, Record<TcType, number>>;
  priorityRules: ResolvedPriorityRule[];
  severityRules: ResolvedSeverityRule[];
}

export function skillManifestToResolved(manifest: SkillManifest): ResolvedSkill {
  const domainOrder = [...DOMAINS] as string[];
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    domainOrder,
    fallbackDomain: "Admin",
    domainKeywords: Object.fromEntries(
      domainOrder.map((d) => [d, manifest.domainKeywords[d as keyof typeof manifest.domainKeywords] ?? []]),
    ),
    templates: Object.fromEntries(
      domainOrder.map((d) => [d, manifest.templates[d as keyof typeof manifest.templates] ?? []]),
    ),
    domainMinSets: Object.fromEntries(
      domainOrder.map((d) => [
        d,
        manifest.domainMinSets[d as keyof typeof manifest.domainMinSets] ??
          ({} as Record<TcType, number>),
      ]),
    ),
    priorityRules: manifest.priorityRules.map((r) => ({
      domain: r.domain as string,
      types: r.types,
      priority: r.priority,
    })),
    severityRules: manifest.severityRules.map((r) => ({
      domain: r.domain as string,
      types: r.types,
      severity: r.severity,
    })),
  };
}

/** Taxonomy LLM이 반환하는 도메인 단위 페이로드 (Zod 검증 후 merge) */
export interface TaxonomyDomainPayload {
  id: string;
  keywords: string[];
  minSets?: Partial<Record<TcType, number>>;
  templates: TcTemplate[];
}

function normalizeMinSet(partial?: Partial<Record<TcType, number>>): Record<TcType, number> {
  return Object.fromEntries(
    TC_TYPES.map((t) => [t, partial?.[t] ?? 0]),
  ) as Record<TcType, number>;
}

/** 베이스 스킬의 우선순위·심각도 규칙을 유지하고, 도메인·키워드·템플릿·최소세트는 Taxonomy로 덮어씀 */
export function mergeTaxonomyIntoResolved(
  base: SkillManifest,
  taxonomy: { domains: TaxonomyDomainPayload[] },
): ResolvedSkill {
  const baseResolved = skillManifestToResolved(base);
  if (taxonomy.domains.length === 0) {
    throw new Error("Taxonomy returned no domains");
  }

  const domainOrder = taxonomy.domains.map((d) => d.id) as readonly string[];
  const fallbackDomain = domainOrder[0]!;

  const domainKeywords: Record<string, string[]> = {};
  const templates: Record<string, TcTemplate[]> = {};
  const domainMinSets: Record<string, Record<TcType, number>> = {};

  for (const d of taxonomy.domains) {
    domainKeywords[d.id] = d.keywords;
    templates[d.id] = d.templates;
    domainMinSets[d.id] = normalizeMinSet(d.minSets);
  }

  return {
    id: base.id,
    name: base.name,
    description: base.description,
    domainOrder,
    fallbackDomain,
    domainKeywords,
    templates,
    domainMinSets,
    priorityRules: baseResolved.priorityRules,
    severityRules: baseResolved.severityRules,
  };
}
