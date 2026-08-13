import { v4 as uuidv4 } from "uuid";
import type { AiBodyBlockList, BusinessProfileRecord, PostType } from "@app/shared";
import { AiDraftResponseSchema, aiDraftJsonSchema, type AiBlock } from "./schema.js";
import {
  buildInitialPrompt,
  buildJsonRepairPrompt,
  buildCorrectionPrompt,
  type DedupEntry,
  type GenerateDraftInput as PromotionalPromptInput,
} from "./prompt.js";
import {
  buildInformationalPrompt,
  buildInformationalJsonRepairPrompt,
  buildInformationalCorrectionPrompt,
  type GenerateInformationalInput,
} from "./promptInformational.js";
import { runPromotionalQaCheck, runInformationalQaCheck } from "./qaCheck.js";
import { runClaudeQuery } from "./client.js";

export interface GenerateDraftInput {
  postType: PostType;
  /** Used verbatim for 홍보성 (required, force-kept). Ignored for 정보성 —
   * the AI generates its own title from `keyword` instead. */
  title: string;
  /** Target keyword (홍보성, exactly-4-mentions rule) or topic keyword
   * (정보성, required — this is what the AI builds the title/angle from). */
  keyword: string;
  highlightContent: string;
  profile: BusinessProfileRecord;
  /** Recent same-type posts to steer the model away from repeating. */
  avoidOverlapWith?: DedupEntry[];
}

export interface GenerateDraftResult {
  /** Force-set to input.title for 홍보성; the AI's own generated title for
   * 정보성 (never trusted for 홍보성, always trusted for 정보성 — that
   * asymmetry is the whole point of this field). */
  title: string;
  /** AI-authored body blocks only — assemble.ts sandwiches these between the
   * code-assembled greeting/talktalk/reservation/hashtags per postType. */
  blocks: AiBodyBlockList;
  charCount: number;
  keywordCount: number;
  /** Set when the self-check retries were exhausted without hitting spec —
   * surfaced as a visible warning in the draft review screen, never
   * silently swallowed. */
  qaWarning: string | null;
}

const MAX_JSON_REPAIR_ATTEMPTS = 2;
const MAX_QA_RETRY_ATTEMPTS = 3;
// WebSearch round-trips (search call + result + reasoning) burn turns fast —
// the no-tools case only ever needed ~2, this leaves headroom for a few
// searches without silently truncating a turn-limited generation.
const MAX_TURNS_WITH_SEARCH = 20;
// Available to the model but not mandatory for 홍보성 (only used if the
// draft needs to back a factual claim); effectively mandatory for 정보성
// via that prompt's own instructions.
const RESEARCH_TOOLS = ["WebSearch"];

type ParseOutcome =
  | { ok: true; title: string; blocks: AiBlock[] }
  | { ok: false; error: string; rawText: string };

function withIds(blocks: AiBlock[]): AiBodyBlockList {
  // Safe: AiBlock (schema.ts) mirrors shared's AiBodyBlock field-for-field
  // minus `id`, so injecting one here reconstructs the shared shape exactly.
  return blocks.map((b) => ({ ...b, id: uuidv4() })) as AiBodyBlockList;
}

async function callAndParse(prompt: string): Promise<ParseOutcome> {
  const result = await runClaudeQuery(prompt, aiDraftJsonSchema(), {
    tools: RESEARCH_TOOLS,
    maxTurns: MAX_TURNS_WITH_SEARCH,
  });
  if (!result.ok) {
    return { ok: false, error: result.errorMessage ?? "AI 호출 실패", rawText: result.resultText };
  }

  // Prefer the SDK's native structured_output (outputFormat: json_schema);
  // fall back to defensively parsing result text in case a CLI version
  // omits it for some reason.
  let candidate: unknown = result.structuredOutput;
  if (candidate === undefined) {
    const text = result.resultText
      .trim()
      .replace(/^```(?:json)?\n?/, "")
      .replace(/```$/, "");
    try {
      candidate = JSON.parse(text);
    } catch {
      return { ok: false, error: "JSON 파싱 실패", rawText: result.resultText };
    }
  }

  const parsed = AiDraftResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: `스키마 불일치: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      rawText: JSON.stringify(candidate),
    };
  }
  return { ok: true, title: parsed.data.title, blocks: parsed.data.blocks };
}

export async function generateDraft(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  return input.postType === "informational" ? generateInformational(input) : generatePromotional(input);
}

async function generatePromotional(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  const promptInput: PromotionalPromptInput = {
    title: input.title,
    keyword: input.keyword,
    highlightContent: input.highlightContent,
    profile: input.profile,
    avoidOverlapWith: input.avoidOverlapWith,
  };

  let blocks: AiBodyBlockList | undefined;
  let prompt = buildInitialPrompt(promptInput);

  for (let attempt = 0; attempt <= MAX_JSON_REPAIR_ATTEMPTS; attempt++) {
    const parsed = await callAndParse(prompt);
    if (parsed.ok) {
      blocks = withIds(parsed.blocks);
      break;
    }
    if (attempt === MAX_JSON_REPAIR_ATTEMPTS) {
      throw new Error(`AI 응답을 ${MAX_JSON_REPAIR_ATTEMPTS + 1}회 시도해도 파싱하지 못했습니다: ${parsed.error}`);
    }
    prompt = buildJsonRepairPrompt(promptInput, parsed.error, parsed.rawText);
  }
  if (!blocks) throw new Error("AI 초안 생성 실패"); // unreachable, keeps TS control-flow analysis honest

  // parsed.title is intentionally never used here — 홍보성 always keeps the
  // user's exact input.title (the force-overwrite is simply never reading
  // the model's title field at all).
  let qa = runPromotionalQaCheck(blocks, input.keyword);
  for (let attempt = 0; attempt < MAX_QA_RETRY_ATTEMPTS && !qa.ok; attempt++) {
    const correctionPrompt = buildCorrectionPrompt(promptInput, blocks, qa.issues);
    const parsed = await callAndParse(correctionPrompt);
    if (!parsed.ok) break; // keep the previous (still-imperfect) draft rather than losing it
    blocks = withIds(parsed.blocks);
    qa = runPromotionalQaCheck(blocks, input.keyword);
  }

  return {
    title: input.title,
    blocks,
    charCount: qa.charCount,
    keywordCount: qa.keywordCount,
    qaWarning: qa.ok ? null : qa.issues.join(" / "),
  };
}

async function generateInformational(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  const promptInput: GenerateInformationalInput = {
    keyword: input.keyword,
    highlightContent: input.highlightContent,
    profile: input.profile,
    avoidOverlapWith: input.avoidOverlapWith,
  };

  let blocks: AiBodyBlockList | undefined;
  let title = "";
  let prompt = buildInformationalPrompt(promptInput);

  for (let attempt = 0; attempt <= MAX_JSON_REPAIR_ATTEMPTS; attempt++) {
    const parsed = await callAndParse(prompt);
    if (parsed.ok) {
      blocks = withIds(parsed.blocks);
      title = parsed.title;
      break;
    }
    if (attempt === MAX_JSON_REPAIR_ATTEMPTS) {
      throw new Error(`AI 응답을 ${MAX_JSON_REPAIR_ATTEMPTS + 1}회 시도해도 파싱하지 못했습니다: ${parsed.error}`);
    }
    prompt = buildInformationalJsonRepairPrompt(promptInput, parsed.error, parsed.rawText);
  }
  if (!blocks) throw new Error("AI 초안 생성 실패"); // unreachable, keeps TS control-flow analysis honest

  let qa = runInformationalQaCheck(blocks, input.keyword);
  for (let attempt = 0; attempt < MAX_QA_RETRY_ATTEMPTS && !qa.ok; attempt++) {
    const correctionPrompt = buildInformationalCorrectionPrompt(promptInput, title, blocks, qa.issues);
    const parsed = await callAndParse(correctionPrompt);
    if (!parsed.ok) break;
    blocks = withIds(parsed.blocks);
    title = parsed.title;
    qa = runInformationalQaCheck(blocks, input.keyword);
  }

  return {
    // Extremely unlikely fallback — every successful parse carries a title
    // (the schema requires the field), this only guards a blank string.
    title: title.trim() || input.keyword,
    blocks,
    charCount: qa.charCount,
    keywordCount: qa.keywordCount,
    qaWarning: qa.ok ? null : qa.issues.join(" / "),
  };
}
