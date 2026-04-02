import type { ChecklistItem, TestCase } from "../../types/tc.js";
import type { EvaluationIssue } from "../../types/pipeline.js";
import type { ResolvedSkill } from "../../skills/resolved-skill.js";
import { TC_TYPES } from "../../types/tc.js";

export function buildRepairPrompt(
  issues: EvaluationIssue[],
  uncoveredItems: ChecklistItem[],
  existingTcs: TestCase[],
  resolved: ResolvedSkill,
  config: { ownerDefault: string; environmentDefault: string },
  nextTcId: number,
): string {
  const issuesSummary = issues
    .slice(0, 30)
    .map((i) => `  - [${i.type}] ${i.message}`)
    .join("\n");

  const uncoveredJson = uncoveredItems.slice(0, 20).map((c) => ({
    requirementId: c.requirementId,
    feature: c.feature,
    domain: c.domain,
    description: c.description,
    sourceRow: c.sourceRow,
    sourceSheet: c.sourceSheet,
  }));

  const tcSample = existingTcs.slice(0, 5).map((tc) => ({
    TC_ID: tc.TC_ID,
    Feature: tc.Feature,
    Type: tc.Type,
    Priority: tc.Priority,
    Severity: tc.Severity,
  }));

  const minSets = resolved.domainOrder
    .map((d) => `  ${d}: ${JSON.stringify(resolved.domainMinSets[d] ?? {})}`)
    .join("\n");

  return `당신은 시니어 QA 엔지니어입니다. 아래 평가 결과를 바탕으로 TC를 보완/수정하세요.

## 언어 규칙
- Scenario, Precondition, Test_Steps, Test_Data, Expected_Result, Notes, repairNotes 등 **자연어 필드는 반드시 한국어**로 작성하세요.
- TC_ID, Feature, Requirement_ID, Type, Priority, Severity 등 고정 필드는 영문 규격을 유지합니다.

## 발견된 평가 이슈
${issuesSummary}

## 미커버 체크리스트 항목
${JSON.stringify(uncoveredJson, null, 2)}

## 기존 TC 샘플 (스타일 참고용)
${JSON.stringify(tcSample, null, 2)}

## 도메인 최소 세트
${minSets}

## 허용 값
- Type: ${JSON.stringify([...TC_TYPES])}
- Priority: ["P0", "P1", "P2"]
- Severity: ["S1", "S2", "S3"]

## 작업
1. 미커버 체크리스트 항목을 커버하는 **새 TC**를 생성하세요.
2. 커버리지 부족, 도메인 최소 세트 미달 등 추가 TC로 해결 가능한 이슈를 수정하세요.
3. TC_ID 형식: "TC-XXXX", TC-${String(nextTcId).padStart(4, "0")}부터 시작합니다.
4. Environment: "${config.environmentDefault}", Owner: "${config.ownerDefault}", Status: "Draft", Automation_Candidate: "N".
5. Traceability: "{sourceSheet}!R{sourceRow}".

## 출력 형식
아래 형식의 JSON 객체를 반환하세요:
{
  "newTestCases": [ ... TestCase 객체 배열 ... ],
  "repairNotes": "수정 내용 요약 (한국어)"
}

TestCase 필드: TC_ID, Feature, Requirement_ID, Scenario, Precondition, Test_Steps, Test_Data, Expected_Result, Priority, Severity, Type, Environment, Owner, Status, Automation_Candidate, Traceability, Notes

유효한 JSON만 반환하세요. 마크다운 펜스나 설명은 포함하지 마세요.`;
}
