import { query } from "@anthropic-ai/claude-agent-sdk";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Isolated from the project entirely — pointing cwd somewhere unrelated is
// an independent layer of isolation on top of the tool allowlist below.
const SCRATCH_DIR = path.join(os.tmpdir(), "naver-blog-automation-ai-scratch");

export interface ClaudeQueryResult {
  ok: boolean;
  resultText: string;
  structuredOutput: unknown;
  errorMessage?: string;
}

export interface ClaudeQueryOptions {
  /**
   * Built-in tool names to allow, e.g. ["WebSearch"] for research-grounded
   * generation (정보성 글, and promotional posts that need to back a factual
   * claim). Omit/empty for text-generation-only calls — file/bash/etc tools
   * are never included regardless of what's passed here; this module only
   * ever forwards an explicit allowlist, never a preset.
   */
  tools?: string[];
  maxTurns?: number;
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
  options: ClaudeQueryOptions = {},
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
      tools: options.tools ?? [], // no file/bash access ever; WebSearch only when explicitly requested
      cwd: SCRATCH_DIR,
      maxTurns: options.maxTurns ?? 4,
      outputFormat: { type: "json_schema", schema: jsonSchema },
    },
  });

  let ok = false;
  let resultText = "";
  let structuredOutput: unknown;
  let errorMessage: string | undefined;

  for await (const message of stream) {
    if (message.type === "assistant") {
      const content = message.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block && typeof block === "object" && "type" in block && block.type === "tool_use") {
            const input = "input" in block ? JSON.stringify(block.input).slice(0, 200) : "";
            console.log(`[ai] tool_use: ${"name" in block ? block.name : "?"} ${input}`);
          }
        }
      }
    }
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
