import { v4 as uuidv4 } from "uuid";
import type { AiBodyBlockList } from "@app/shared";
import { AiDraftResponseSchema, aiDraftJsonSchema, type AiBlock } from "./schema.js";
import {
  buildInitialPrompt,
  buildJsonRepairPrompt,
  buildCorrectionPrompt,
  type GenerateDraftInput,
} from "./prompt.js";
import { runQaCheck } from "./qaCheck.js";
import { runClaudeQuery } from "./client.js";

export type { GenerateDraftInput } from "./prompt.js";

export interface GenerateDraftResult {
  /** AI-authored body blocks only — assemble.ts sandwiches these between the
   * code-assembled greeting/talktalk (before) and prewritten/reservation/
   * related-post/hashtags (after). */
  blocks: AiBodyBlockList;
  charCount: number;
  keywordCount: number;
  /** Set when the self-check retries were exhausted without hitting spec —
   * surfaced as a visible warning in the draft review screen (M4), never
   * silently swallowed. */
  qaWarning: string | null;
}

const MAX_JSON_REPAIR_ATTEMPTS = 2;
const MAX_QA_RETRY_ATTEMPTS = 3;

type ParseOutcome =
  | { ok: true; blocks: AiBlock[] }
  | { ok: false; error: string; rawText: string };

function withIds(blocks: AiBlock[]): AiBodyBlockList {
  // Safe: AiBlock (schema.ts) mirrors shared's AiBodyBlock field-for-field
  // minus `id`, so injecting one here reconstructs the shared shape exactly.
  return blocks.map((b) => ({ ...b, id: uuidv4() })) as AiBodyBlockList;
}

async function callAndParse(prompt: string): Promise<ParseOutcome> {
  const result = await runClaudeQuery(prompt, aiDraftJsonSchema());
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
  // parsed.data.title is intentionally discarded here — callers always use
  // the original request title verbatim (title force-overwrite happens by
  // simply never propagating the model's title anywhere downstream).
  return { ok: true, blocks: parsed.data.blocks };
}

export async function generateDraft(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  let blocks: AiBodyBlockList | undefined;
  let prompt = buildInitialPrompt(input);

  for (let attempt = 0; attempt <= MAX_JSON_REPAIR_ATTEMPTS; attempt++) {
    const parsed = await callAndParse(prompt);
    if (parsed.ok) {
      blocks = withIds(parsed.blocks);
      break;
    }
    if (attempt === MAX_JSON_REPAIR_ATTEMPTS) {
      throw new Error(
        `AI 응답을 ${MAX_JSON_REPAIR_ATTEMPTS + 1}회 시도해도 파싱하지 못했습니다: ${parsed.error}`,
      );
    }
    prompt = buildJsonRepairPrompt(input, parsed.error, parsed.rawText);
  }
  if (!blocks) {
    // Unreachable (the loop above either returns blocks or throws), but
    // keeps TypeScript's control-flow analysis honest below.
    throw new Error("AI 초안 생성 실패");
  }

  let qa = runQaCheck(blocks, input.keyword);
  for (let attempt = 0; attempt < MAX_QA_RETRY_ATTEMPTS && !qa.ok; attempt++) {
    const correctionPrompt = buildCorrectionPrompt(input, blocks, qa.issues);
    const parsed = await callAndParse(correctionPrompt);
    if (!parsed.ok) break; // keep the previous (still-imperfect) draft rather than losing it
    blocks = withIds(parsed.blocks);
    qa = runQaCheck(blocks, input.keyword);
  }

  return {
    blocks,
    charCount: qa.charCount,
    keywordCount: qa.keywordCount,
    qaWarning: qa.ok ? null : qa.issues.join(" / "),
  };
}
