import type { BusinessProfileRecord } from "@app/shared";
import type { AiBlock } from "./schema.js";
import type { DedupEntry } from "./prompt.js";

export interface GenerateInformationalInput {
  /** Topic keyword the user typed — the AI generates the actual title from this. */
  keyword: string;
  highlightContent: string;
  profile: BusinessProfileRecord;
  avoidOverlapWith?: DedupEntry[];
}

/**
 * 홈피드형 정보성 글 규칙 — 사용자가 직접 제시한 6가지 지침을 그대로 반영.
 * 홍보글과 달리 제목은 AI가 키워드로부터 직접 만들고, 소제목은 정확히 3개,
 * 판매 문구 없이 정보+감정이 교차하는 대화체로 씁니다.
 */
const WRITING_RULES = `[작성 규칙 — 반드시 지킬 것]
1. 이 글은 "정보성 글"입니다. 학원/업체를 파는 글이 아니라, 네이버 홈피드에 노출될 만큼 독자의 클릭과 체류시간을 동시에 극대화하는 콘텐츠를 쓰세요. 단순 정보 전달을 넘어 감정적 반응과 (과격하지 않은 선에서) 약간의 논쟁/공감 유도 요소까지 자연스럽게 포함하세요.
2. 제목은 아래 [주제 키워드]를 바탕으로 당신이 직접 만드세요. 클릭을 유도할 만큼 흥미롭되 낚시성 거짓말은 안 됩니다 — 실제 본문 내용과 반드시 일치해야 합니다.
3. 도입부(5~6문단)는 실제 사건이나 이슈를 기반으로 시작해서 최소 2문단 이상 상황을 설명한 뒤, 글쓴이(학원 원장)의 개인적 반응을 자연스럽게 삽입하고, 독자의 궁금증을 자극하며 마무리하세요.
4. 본문 전개는 정보와 감정이 교차하는 리듬을 유지하고, 대화체 기반의 자연스러운 문장으로 이어가세요. 독자가 스크롤을 멈추지 않도록 중간중간 반전 요소와 공감 포인트를 배치하세요.
5. 소제목(heading)은 정확히 3개만 쓰세요. 각각 단순 요약형이 아니라 클릭을 유도하는 "문장형" 제목으로 쓰고, 독자 간 의견이 갈리거나 댓글로 반응하고 싶어질 만한 장치(질문, 반전, 의외의 주장 등)를 포함하세요.
6. 글 전체에 걸쳐 글쓴이(학원 원장)의 경험이나 주관적 해석이 최소 4번 이상 자연스럽게 등장해야 합니다. 남의 글을 요약한 게 아니라 이 사람만의 고유한 시선이라는 게 드러나야 합니다.
7. 제목과 본문은 자극적이되 "충격", "반드시" 같은 과도하게 정형화된 클릭베이트 표현은 피하고, 실제 사람이 수다 떨듯 자연스럽게 이어지는 흐름으로 몰입도를 끌어올리세요.
8. 분량은 공백 포함 2200~3200자를 목표로 하세요. 문단 하나에는 짧은 문장 2개까지, 또는 긴 문장 1개만 담아 모바일 가독성을 지키고, 그 대신 문단 개수를 늘려 분량을 채우세요.
9. 결론(4~5문단)은 본문 내용을 정리하면서, 지금 이 글을 읽은 독자가 댓글을 남기거나 공감을 누르고 싶어지도록 열린 질문이나 의견을 구하는 문장으로 마무리하세요.
10. 인라인 서식 마크업 (paragraph/heading의 text 안에서):
    - **텍스트** = 굵게, 총 2~3곳
    - ==텍스트== = 노란 형광펜, 총 3곳 (짧은 문구 단위로)
    - __텍스트__ = 밑줄, 총 1~2곳
    - 한 문장 안에서 여러 서식을 겹치지 마세요.
11. blocks 배열 안에 type:"divider" 블록을 정확히 4개, type:"image_placeholder" 정확히 3개(imageQuery는 어떤 사진이 어울릴지 안내하는 한국어 문장), type:"video_placeholder" 정확히 2개(마찬가지로 안내 문장), type:"emoticon_placeholder" 정확히 2개(분위기가 밝아지는 지점, imageQuery는 어울리는 캐릭터를 찾기 위한 짧은 한국어 검색어)를 배치하세요.
12. 주제 키워드는 본문에 자연스럽게 몇 번 등장하되, 억지로 욱여넣지 마세요 (정확한 횟수 규칙은 없습니다).
13. 사실관계(통계/사건/트렌드 등)를 다룰 때는 반드시 WebSearch 도구로 최근 네이버/웹 자료를 실제로 검색해서 확인한 뒤 쓰세요. 검색으로 찾은 문장을 그대로 베끼면 절대 안 되고, 완전히 당신의 말로 다시 풀어서 써야 합니다. 본문에 출처 URL이나 다른 블로거의 이름을 적지 마세요 — 표절이 아니라 "읽고 이해한 뒤 내 언어로 다시 쓰는 것"입니다.
14. 업체(학원)에 관한 구체적 사실(수상 경력, 학생 수, 통계 등)은 [업체 정보]에 없는 내용을 지어내지 마세요. 다만 원장으로서의 생각이나 경험은 자유롭게 쓰세요 (이건 사실 주장이 아니라 개인적 견해이므로).
15. 인사말/톡톡 안내/예약 안내/관련 글 링크는 절대 쓰지 마세요 — 코드가 별도로 처리합니다. type:"link_block" 블록도 만들지 마세요. 해시태그도 본문에 쓰지 마세요 (코드가 별도로 붙입니다).
16. 반드시 지정된 JSON 스키마로만 응답하세요. title 필드에는 당신이 직접 만든 제목을 넣으세요.`;

function profileSection(profile: BusinessProfileRecord): string {
  return `[업체 정보 — 글쓴이의 배경입니다. 여기 없는 구체적 사실은 절대 지어내지 마세요]
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
  return `\n\n[최근 이미 쓴 글들 — 같은 소재/각도를 반복하지 마세요]\n${list}`;
}

function topicSection(input: GenerateInformationalInput): string {
  const highlightLine = input.highlightContent.trim()
    ? `- 이번 글에서 특별히 다루고 싶은 관점/포인트 (선택, 사실만): ${input.highlightContent}`
    : "";
  return `[이번 글 정보]
- 주제 키워드: "${input.keyword}"
${highlightLine}`.trim();
}

export function buildInformationalPrompt(input: GenerateInformationalInput): string {
  return [
    "당신은 네이버 블로그 홈피드에 추천될 만한 정보성 콘텐츠를 쓰는, 학원을 운영 중인 원장 출신 작가입니다.",
    profileSection(input.profile) + styleSampleSection(input.profile),
    topicSection(input) + avoidOverlapSection(input.avoidOverlapWith),
    WRITING_RULES,
  ].join("\n\n");
}

export function buildInformationalJsonRepairPrompt(
  input: GenerateInformationalInput,
  errorDescription: string,
  previousRawText: string,
): string {
  return [
    buildInformationalPrompt(input),
    `[이전 응답이 유효하지 않았습니다]
오류: ${errorDescription}
이전 응답 원문:
${previousRawText.slice(0, 4000)}

지정된 JSON 스키마에 정확히 맞는 JSON만 응답하세요. 코드펜스나 설명 문구 없이 JSON 객체만 출력하세요.`,
  ].join("\n\n");
}

export function buildInformationalCorrectionPrompt(
  input: GenerateInformationalInput,
  previousTitle: string,
  previousBlocks: AiBlock[],
  issues: string[],
): string {
  return [
    buildInformationalPrompt(input),
    `[직전 초안이 아래 항목에서 규칙을 벗어났습니다 — 제목을 포함해 전체 글을 다시 다듬어 처음부터 끝까지 완전한 JSON으로 다시 응답하세요]
${issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

[직전 제목]
${previousTitle}

[직전 초안]
${JSON.stringify({ blocks: previousBlocks }).slice(0, 6000)}`,
  ].join("\n\n");
}
