import { z } from "zod";
import type { BusinessProfileRecord } from "@app/shared";
import { runClaudeQuery } from "./client.js";

const ProposedTopicSchema = z.object({
  topic: z
    .string()
    .describe("정보성 블로그 글의 주제를 나타내는 짧은 한국어 키워드/구절 (제목이 아니라 소재).예: '아이 손 작을 때 피아노 배우면 안 좋을까'"),
});

function proposedTopicJsonSchema(): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(ProposedTopicSchema) as Record<string, unknown>;
  return rest;
}

export interface ProposeTopicInput {
  profile: BusinessProfileRecord;
  /** Titles/keywords already used recently — steer away from repeats. */
  avoidTopics: string[];
}

const TOOLS = ["WebSearch"];
const MAX_TURNS = 10;

/**
 * Used only when a schedule's 글감 큐 (keyword_ideas) is empty — the AI
 * picks its own fresh informational-post topic instead of the run being
 * skipped. Keeps this completely separate from generateDraft's own prompt
 * building: this call's only job is producing one short topic string, which
 * then flows into the normal informational generateDraft() as `keyword`,
 * exactly as if the user had typed it in herself.
 */
export async function proposeTopic(input: ProposeTopicInput): Promise<string> {
  const avoidSection = input.avoidTopics.length
    ? `\n\n[최근에 이미 다룬 주제 — 겹치지 않는 새로운 주제를 고르세요]\n${input.avoidTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    : "";

  const prompt = [
    "당신은 피아노 학원(원장 겸 블로거)의 블로그 운영을 돕는 편집자입니다.",
    `[업체 정보]\n- 업체명: ${input.profile.name || "(미등록)"}\n- 강점/특징: ${input.profile.strengths || "(미등록)"}`,
    "오늘 정보성 블로그 글로 다룰 만한 주제를 딱 하나만 골라주세요. " +
      "학부모들이 실제로 궁금해하거나 요즘 화제가 될 만한 피아노/음악교육 관련 소재여야 합니다 " +
      "(예: 나이별 시작 시기, 연습 습관, 악기 선택, 콩쿠르, 슬럼프, 손 크기, 절대음감, 디지털 vs 어쿠스틱 등). " +
      "필요하면 WebSearch로 요즘 학부모 커뮤니티/뉴스에서 화제인 것을 참고해도 됩니다. " +
      "topic 필드에는 완성된 제목이 아니라, 그 글이 무엇에 대한 것인지 알 수 있는 짧은 한국어 키워드/질문 형태로 적어주세요." +
      avoidSection,
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
