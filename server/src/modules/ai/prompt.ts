import type { BusinessProfileRecord } from "@app/shared";
import type { AiBlock } from "./schema.js";

export interface DedupEntry {
  title: string;
  snippet: string;
}

export interface GenerateDraftInput {
  title: string;
  keyword: string;
  highlightContent: string;
  profile: BusinessProfileRecord;
  /** Recent already-published/drafted posts to steer away from repeating. */
  avoidOverlapWith?: DedupEntry[];
}

const WRITING_RULES = `[작성 규칙 — 반드시 지킬 것]
1. 사실만 쓰세요. 위 [업체 정보]와 [이번 글에서 강조할 내용]에 없는 구체적 사실(수상 경력, 통계, 학생 수, 순위 등)은 절대로 지어내지 마세요. 다만 어떤 정보(트렌드, 일반 상식, 통계 등)를 다룰 때 더 신뢰도 있게 쓰고 싶다면 WebSearch 도구로 검증된 자료를 찾아 참고해도 됩니다 — 찾은 내용은 반드시 당신의 말로 자연스럽게 풀어 쓰고, 문장을 그대로 베끼거나 출처 URL을 본문에 적지 마세요.
2. 분량은 공백 포함 2500~3200자가 최우선 규칙입니다. 다른 모든 지침보다 이 글자수 규칙이 우선합니다.
   - 모바일 가독성을 위해 문단 하나에는 짧은 문장 2개까지, 또는 긴 문장 1개만 담으세요. 그 대신 문단의 "개수"를 늘려서 분량을 채우세요 (문단을 길게 쓰지 말 것).
   - 글을 다 쓴 뒤 스스로 전체 글자수를 세어보고, 부족하면 반드시 문단을 더 추가해서 채우세요.
3. 구조: 서론 5~6문단, 소제목(heading) 3~4개, 소제목 하나당 문단 8~10개, 결론 4~5문단.
4. 서론은 딱딱한 인사말로 시작하지 말고, 학부모님들이 흔히 갖는 궁금증/걱정으로 공감형으로 시작하세요.
5. 본론에는 교육 철학이나 느낀 점이 자연스럽게 녹아들게 쓰세요. 과장 광고 문구, 근거 없는 최상급 표현("최고", "1등" 등)은 쓰지 마세요.
6. 인라인 서식 마크업 (paragraph/heading의 text 안에서):
   - **텍스트** = 굵게, 총 2~3곳
   - ==텍스트== = 노란 형광펜, 총 3곳 (짧은 문구 단위로)
   - __텍스트__ = 밑줄, 총 1~2곳
   - 한 문장 안에서 여러 서식을 겹치지 마세요. 전체 글에 고르게 분산하세요.
7. blocks 배열 안에 type:"divider" 블록을 정확히 4개, 흐름이 바뀌는 지점에 배치하세요.
8. type:"image_placeholder" 블록을 정확히 3개 배치하세요. imageQuery에는 검색어가 아니라, 그 자리에 어떤 사진을 넣으면 좋을지 안내하는 한국어 문장을 쓰세요 (예: "학생들이 수업에 집중하고 있는 모습 사진").
9. type:"video_placeholder" 블록을 정확히 2개 배치하세요. imageQuery도 마찬가지로 어떤 영상을 넣으면 좋을지 안내하는 한국어 문장으로 쓰세요.
10. type:"emoticon_placeholder" 블록을 정확히 2개 배치하세요. 분위기가 밝아지는 지점(축하/응원/뿌듯함)에 배치하고, 소제목이나 구분선 바로 옆에는 배치하지 마세요. imageQuery에는 어울리는 귀여운 캐릭터를 찾기 위한 짧은 한국어 검색어를 쓰세요 (예: "박수 치는 캐릭터").
11. 타겟 키워드가 있다면 본문(문단/소제목 text)에 정확히 4번 등장해야 합니다 (서론 1, 본론 2, 결론 1 정도로 분산). 어색하게 욱여넣지 마세요.
12. 다 쓴 후 키워드 등장 횟수와 글자수를 스스로 세어보고, 규칙에 안 맞으면 조정하세요.
13. 인사말, 네이버 톡톡 안내, 주소/예약 안내, 관련 글 링크, 해시태그는 절대 쓰지 마세요 — 그건 서론-본론-결론 "본문"이 아니며, 코드가 별도로 고정 삽입합니다. type:"link_block"이나 type:"hashtags" 블록도 만들지 마세요.
14. 반드시 지정된 JSON 스키마로만 응답하세요. title 필드에는 아래 제목을 정확히 그대로 넣으세요 (한 글자도 바꾸지 마세요).`;

function profileSection(profile: BusinessProfileRecord): string {
  return `[업체 정보 — 사실 정보. 여기 없는 구체적 사실은 절대 지어내지 마세요]
- 업체명: ${profile.name || "(미등록)"}
- 위치: ${profile.address || "(미등록)"}
- 강점/특징: ${profile.strengths || "(미등록)"}
- 참고사항: ${profile.notes || "(미등록)"}`;
}

function styleSampleSection(profile: BusinessProfileRecord): string {
  if (!profile.styleSample.trim()) return "";
  return `\n\n[말투 참고 샘플 — 문체만 참고하고, 내용을 그대로 베끼지 마세요]\n${profile.styleSample}`;
}

function avoidOverlapSection(entries: DedupEntry[] | undefined): string {
  if (!entries || entries.length === 0) return "";
  const list = entries.map((e, i) => `${i + 1}. "${e.title}" — ${e.snippet}`).join("\n");
  return `\n\n[최근 이미 쓴 글들 — 같은 이야기/각도를 반복하지 마세요. 새로운 소재나 관점으로 쓰세요]\n${list}`;
}

function postSection(input: GenerateDraftInput): string {
  const { title, keyword, highlightContent } = input;
  const keywordLine = keyword.trim()
    ? `- 타겟 키워드: "${keyword}" (본문에 정확히 4번 등장시킬 것)`
    : "- 타겟 키워드: 없음 (키워드 반복 규칙은 적용하지 않음)";
  const highlightLine = highlightContent.trim()
    ? `- 이번 글에서 강조할 내용 (사실만): ${highlightContent}`
    : "";
  return `[이번 글 정보]
- 제목 (그대로 유지할 것): ${title}
${keywordLine}
${highlightLine}`.trim();
}

export function buildInitialPrompt(input: GenerateDraftInput): string {
  return [
    "당신은 학원/업체 블로그 홍보글의 '본문(서론-본론-결론)'만 작성하는 작가입니다.",
    profileSection(input.profile) + styleSampleSection(input.profile),
    postSection(input) + avoidOverlapSection(input.avoidOverlapWith),
    WRITING_RULES,
  ].join("\n\n");
}

/** JSON parsing/schema-validation failed — ask for a corrected JSON-only response. */
export function buildJsonRepairPrompt(
  input: GenerateDraftInput,
  errorDescription: string,
  previousRawText: string,
): string {
  return [
    buildInitialPrompt(input),
    `[이전 응답이 유효하지 않았습니다]
오류: ${errorDescription}
이전 응답 원문:
${previousRawText.slice(0, 4000)}

지정된 JSON 스키마에 정확히 맞는 JSON만 응답하세요. 코드펜스나 설명 문구 없이 JSON 객체만 출력하세요.`,
  ].join("\n\n");
}

/** JSON was valid but the QA self-check (length/keyword/placeholder counts) failed. */
export function buildCorrectionPrompt(
  input: GenerateDraftInput,
  previousBlocks: AiBlock[],
  issues: string[],
): string {
  return [
    buildInitialPrompt(input),
    `[직전 초안이 아래 항목에서 규칙을 벗어났습니다 — 전체 글을 다시 다듬어 처음부터 끝까지 완전한 JSON으로 다시 응답하세요 (일부만 고쳐서 보내지 마세요)]
${issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

[직전 초안]
${JSON.stringify({ blocks: previousBlocks }).slice(0, 6000)}`,
  ].join("\n\n");
}
