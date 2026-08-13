import { query } from "@anthropic-ai/claude-agent-sdk";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Isolated from the project entirely — the model has no filesystem tools
// anyway (tools: []), but pointing cwd somewhere unrelated is a second,
// independent layer of isolation in case that ever changes.
const SCRATCH_DIR = path.join(os.tmpdir(), "naver-blog-automation-ai-scratch");

export interface ClaudeQueryResult {
  ok: boolean;
  resultText: string;
  structuredOutput: unknown;
  errorMessage?: string;
}

/**
 * Thin wrapper around @anthropic-ai/claude-agent-sdk's query(). Reuses this
 * machine's already-logged-in Claude Code subscription — never set
 * ANTHROPIC_API_KEY in this process's environment (that would silently
 * switch to billed-API mode, which this app is explicitly designed to
 * avoid). The guard below fails loudly instead.
 */
export async function runClaudeQuery(
  prompt: string,
  jsonSchema: Record<string, unknown>,
): Promise<ClaudeQueryResult> {
  if (process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY가 서버 환경에 설정되어 있습니다. 이 프로그램은 클로드 코드 구독 로그인을 재사용하도록 " +
        "설계되어 과금 API 키를 쓰지 않습니다 — 환경변수를 제거한 뒤 다시 시도하세요.",
    );
  }

  fs.mkdirSync(SCRATCH_DIR, { recursive: true });

  const stream = query({
    prompt,
    options: {
      tools: [], // text-generation only — no file/bash/etc access
      cwd: SCRATCH_DIR,
      maxTurns: 4,
      outputFormat: { type: "json_schema", schema: jsonSchema },
    },
  });

  let ok = false;
  let resultText = "";
  let structuredOutput: unknown;
  let errorMessage: string | undefined;

  for await (const message of stream) {
    if (message.type === "result") {
      if (message.subtype === "success") {
        ok = !message.is_error;
        resultText = message.result;
        structuredOutput = message.structured_output;
      } else {
        ok = false;
        errorMessage = `${message.subtype} (stop_reason: ${message.stop_reason ?? "n/a"})${
          message.errors.length ? `: ${message.errors.join("; ")}` : ""
        }`;
      }
    }
  }

  return { ok, resultText, structuredOutput, errorMessage };
}
