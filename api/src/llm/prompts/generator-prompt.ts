import type { ChecklistItem } from "../../types/tc.js";
import type { TcTemplate } from "../../skills/types.js";
import type { ResolvedSkill } from "../../skills/resolved-skill.js";
import { TC_TYPES } from "../../types/tc.js";

function formatTemplateExamples(templates: TcTemplate[], limit = 3): string {
  return templates
    .slice(0, limit)
    .map(
      (t) =>
        `  - Type: ${t.type}, 시나리오: "${t.scenarioSuffix}", 사전조건: "${t.precondition}", 단계: "${t.steps}", 기대결과: "${t.expectedResult}"`,
    )
    .join("\n");
}

export function buildGeneratorPrompt(
  checklist: ChecklistItem[],
  domain: string,
  resolved: ResolvedSkill,
  config: { ownerDefault: string; environmentDefault: string },
  startTcId: number,
): string {
  const domainTemplates = resolved.templates[domain] ?? [];
  const minSet = resolved.domainMinSets[domain] ?? {};

  const checklistJson = checklist.map((c) => ({
    requirementId: c.requirementId,
    feature: c.feature,
    description: c.description,
    sourceRow: c.sourceRow,
    sourceSheet: c.sourceSheet,
  }));

  return `당신은 시니어 QA 엔지니어입니다. "${domain}" 도메인에 대한 테스트 케이스를 생성하세요.

## 언어 규칙
- Scenario, Precondition, Test_Steps, Test_Data, Expected_Result, Notes 등 **자연어 필드는 반드시 한국어**로 작성하세요.
- TC_ID, Feature, Requirement_ID, Type, Priority, Severity 등 고정 필드는 영문 규격을 유지합니다.

## 참고 예시 (스킬 템플릿)
${formatTemplateExamples(domainTemplates, 5)}

## 도메인 최소 세트 요구사항
${Object.keys(minSet).length
    ? Object.entries(minSet).map(([type, count]) => `  - ${type}: 최소 ${count}건`).join("\n")
    : "  - (해당 도메인에 별도 최소 세트 없음)"}

## 허용 TC Type
${JSON.stringify([...TC_TYPES])}

## 커버해야 할 체크리스트 항목
${JSON.stringify(checklistJson, null, 2)}

## 규칙
1. 위 체크리스트 항목을 **모두** 커버하는 TC를 생성하세요.
2. TC_ID는 "TC-XXXX" 형식이며 TC-${String(startTcId).padStart(4, "0")}부터 시작합니다.
3. Scenario 필드는 "[기능명] " 뒤에 테스트 시나리오를 한국어로 작성하세요.
4. Priority는 P0/P1/P2, Severity는 S1/S2/S3 중 하나입니다.
5. Environment: "${config.environmentDefault}", Owner: "${config.ownerDefault}", Status: "Draft", Automation_Candidate: "N".
6. Traceability는 "{sourceSheet}!R{sourceRow}" 형식으로 원본을 참조하세요.
7. 매핑이 불확실한 항목은 Notes에 "MAPPING_GAP:Feature" 또는 "MAPPING_GAP:Requirement_ID"를 추가하세요.
8. 도메인 최소 세트 요구사항을 충족하세요.

## 출력 형식
아래 필드를 가진 JSON 배열을 반환하세요:
TC_ID, Feature, Requirement_ID, Scenario, Precondition, Test_Steps, Test_Data, Expected_Result, Priority, Severity, Type, Environment, Owner, Status, Automation_Candidate, Traceability, Notes

유효한 JSON 배열만 반환하세요. 마크다운 펜스나 설명은 포함하지 마세요.`;
}
