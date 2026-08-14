import { z } from "zod";
import type { BusinessProfileRecord, PostType } from "@app/shared";
import { runClaudeQuery } from "./client.js";

const ProposedTopicSchema = z.object({
  topic: z.string().describe("제안된 주제 (postType에 따라 짧은 키워드/구절이거나 완성된 제목)"),
});

function proposedTopicJsonSchema(): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(ProposedTopicSchema) as Record<string, unknown>;
  return rest;
}

export interface ProposeTopicInput {
  postType: PostType;
  profile: BusinessProfileRecord;
  /** Titles/keywords already used recently — steer away from repeats. */
  avoidTopics: string[];
}

const TOOLS = ["WebSearch"];
const MAX_TURNS = 10;

/**
 * Used only when a schedule's 글감 큐 (keyword_ideas, scoped to the
 * schedule's postType) is empty — the AI picks its own fresh topic instead
 * of the run being skipped.
 *
 * `postType` changes what "topic" even means, so the instructions and
 * output differ:
 * - informational: a short keyword/phrase — flows into generateDraft() as
 *   `keyword`, exactly like the manual "주제 키워드" field. The AI writes
 *   its own title later from this.
 * - promotional: a complete, ready-to-use post title (같은 스타일로 원장이
 *   직접 지었을 법한 홍보 문구) — flows into generateDraft() as `title`
 *   verbatim (홍보성 titles are always trusted as-is, never AI-rewritten
 *   downstream), so this call has to get the whole title right, not just
 *   a topic seed.
 */
export async function proposeTopic(input: ProposeTopicInput): Promise<string> {
  const avoidSection = input.avoidTopics.length
    ? `\n\n[최근에 이미 다룬 주제/제목 — 겹치지 않는 새로운 것을 고르세요]\n${input.avoidTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    : "";

  const taskSection =
    input.postType === "informational"
      ? "오늘 정보성 블로그 글로 다룰 만한 주제를 딱 하나만 골라주세요. " +
        "학부모들이 실제로 궁금해하거나 요즘 화제가 될 만한 피아노/음악교육 관련 소재여야 합니다 " +
        "(예: 나이별 시작 시기, 연습 습관, 악기 선택, 콩쿠르, 슬럼프, 손 크기, 절대음감, 디지털 vs 어쿠스틱 등). " +
        "필요하면 WebSearch로 요즘 학부모 커뮤니티/뉴스에서 화제인 것을 참고해도 됩니다. " +
        "topic 필드에는 완성된 제목이 아니라, 그 글이 무엇에 대한 것인지 알 수 있는 짧은 한국어 키워드/질문 형태로 적어주세요."
      : "오늘 홍보성 블로그 글로 쓸 완성된 제목을 딱 하나만 지어주세요 (제목 그대로 글 제목에 사용되니, 어색하지 않고 " +
        "바로 쓸 수 있는 완결된 문장/구절이어야 합니다). 학원의 강점, 시즌 이슈(신학기/방학/콩쿠르 시즌 등), " +
        "학부모들이 클릭하고 싶어질 만한 각도를 살려서 지어주세요. 과장 광고 문구나 근거 없는 최상급 표현은 피하세요. " +
        "필요하면 WebSearch로 요즘 학부모들이 학원을 고를 때 궁금해하는 점을 참고해도 됩니다. " +
        "topic 필드에 완성된 제목 문장을 그대로 적어주세요.";

  const prompt = [
    "당신은 피아노 학원(원장 겸 블로거)의 블로그 운영을 돕는 편집자입니다.",
    `[업체 정보]\n- 업체명: ${input.profile.name || "(미등록)"}\n- 강점/특징: ${input.profile.strengths || "(미등록)"}`,
    taskSection + avoidSection,
  ].join("\n\n");

  const result = await runClaudeQuery(prompt, proposedTopicJsonSchema(), { tools: TOOLS, maxTurns: MAX_TURNS });
  if (!result.ok) {
    throw new Error(`주제 자동 선정 실패: ${result.errorMessage ?? "AI 호출 실패"}`);
  }

  let candidate: unknown = result.structuredOutput;
  if (candidate === undefined) {
    try {
      candidate = JSON.parse(result.resultText.trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, ""));
    } catch {
      throw new Error("주제 자동 선정 실패: JSON 파싱 실패");
    }
  }

  const parsed = ProposedTopicSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`주제 자동 선정 실패: 스키마 불일치 (${parsed.error.issues.map((i) => i.message).join("; ")})`);
  }
  return parsed.data.topic;
}
