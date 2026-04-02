import type { SkillManifest } from "../../skills/types.js";
import { DOMAINS } from "../../types/tc.js";

export function buildPlanPrompt(
  headers: string[],
  sampleRows: string[][],
  sourceSheetName: string,
  skill: SkillManifest,
): string {
  const domainKeywordsSection = DOMAINS.map(
    (d) => `  - ${d}: ${skill.domainKeywords[d].join(", ")}`,
  ).join("\n");

  const rowsPreview = sampleRows
    .slice(0, 30)
    .map((row, i) => `  행 ${i + 1}: ${JSON.stringify(row)}`)
    .join("\n");

  return `당신은 시니어 QA 분석가입니다. 아래 스프레드시트 데이터를 분석하여 구조화된 체크리스트를 작성하세요.

## 언어 규칙
- description, feature 등 자연어 필드는 **반드시 한국어**로 작성하세요.
- 필드명(id, requirementId 등)과 고정 enum(Auth, Payment 등)은 영문 그대로 유지합니다.

## 작업
1. 컬럼 중 기능명, 분류(대분류/중분류/소분류), 요구사항 ID, 시나리오/설명, 사전조건에 해당하는 열을 식별하세요.
2. 각 데이터 행마다 올바른 도메인을 분류하여 ChecklistItem을 만드세요.
3. 분류 컬럼은 ">" 구분자로 하나의 feature 필드에 합치세요 (예: "중분류 > 소분류 > 기능명").
4. 요구사항 ID 컬럼이 없으면 "AUTO-{행번호}" 형식으로 생성하세요.

## 도메인 분류 키워드
${domainKeywordsSection}

키워드가 일치하지 않으면 "Admin"으로 기본 분류합니다.

## 시트: "${sourceSheetName}"

### 헤더
${JSON.stringify(headers)}

### 샘플 행 (최대 30건)
${rowsPreview}

## 출력 형식
아래 필드를 가진 JSON 배열을 반환하세요:
- id: string ("CL-XXXX" 형식, XXXX는 행 번호 zero-padded)
- requirementId: string
- feature: string (한국어)
- domain: ${JSON.stringify([...DOMAINS])} 중 하나
- description: string (테스트 가능한 한국어 시나리오 문장)
- sourceRow: number (원본 시트 기준 1-based 행 번호, 헤더 오프셋 포함)
- sourceSheet: "${sourceSheetName}"
- covered: false

유효한 JSON 배열만 반환하세요. 마크다운 펜스나 설명은 포함하지 마세요.`;
}
