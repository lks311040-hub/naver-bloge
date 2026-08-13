import { z } from "zod";

/**
 * AI-facing block schema — identical to shared's AiBodyBlock but WITHOUT
 * `id`. The model has no business inventing unique ids; the server assigns
 * them via uuid immediately after a response validates (see generateDraft.ts
 * `withIds`). Keeping this schema local (not exported from shared) makes
 * that boundary explicit: nothing outside this module should ever construct
 * a "blockless-id" shape.
 */
const AiParagraph = z.object({ type: z.literal("paragraph"), text: z.string() });
const AiHeading = z.object({ type: z.literal("heading"), text: z.string() });
const AiDivider = z.object({ type: z.literal("divider") });
const AiImagePlaceholder = z.object({
  type: z.literal("image_placeholder"),
  imageQuery: z.string(),
});
const AiVideoPlaceholder = z.object({
  type: z.literal("video_placeholder"),
  imageQuery: z.string(),
});
const AiEmoticonPlaceholder = z.object({
  type: z.literal("emoticon_placeholder"),
  imageQuery: z.string(),
});

export const AiBlockSchema = z.discriminatedUnion("type", [
  AiParagraph,
  AiHeading,
  AiDivider,
  AiImagePlaceholder,
  AiVideoPlaceholder,
  AiEmoticonPlaceholder,
]);
export type AiBlock = z.infer<typeof AiBlockSchema>;

/**
 * `title` is included so the model can see/echo the fixed title in context,
 * but the server NEVER trusts it — generateDraft.ts discards it entirely and
 * every caller uses the original user-provided title verbatim.
 */
export const AiDraftResponseSchema = z.object({
  title: z.string(),
  blocks: z.array(AiBlockSchema),
});
export type AiDraftResponse = z.infer<typeof AiDraftResponseSchema>;

let cachedJsonSchema: Record<string, unknown> | undefined;

/**
 * JSON Schema for `Options.outputFormat` (native structured-output mode).
 * The Claude CLI's --json-schema validator rejects a top-level `$schema`
 * meta-key (it tries to resolve it as a $ref and fails), so strip it —
 * z.toJSONSchema() always emits one pointing at the 2020-12 draft.
 */
export function aiDraftJsonSchema(): Record<string, unknown> {
  if (!cachedJsonSchema) {
    const { $schema: _drop, ...rest } = z.toJSONSchema(AiDraftResponseSchema) as Record<string, unknown>;
    cachedJsonSchema = rest;
  }
  return cachedJsonSchema;
}
