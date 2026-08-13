import { z } from "zod";

/**
 * The single source of truth for a post's body structure. Consumed by:
 *  - the AI module (validates model output — only the "AI-authorable"
 *    subset below is ever produced by the model)
 *  - the assembly service (builds the final Block[] for a post)
 *  - the DB layer (validates JSON before persisting to posts.content_blocks)
 *  - the React review UI (one renderer component per block type)
 *  - the Playwright autofill engine (one handler per block type)
 *
 * Every block carries a stable `id` so the review UI and the autofill
 * engine can address a specific block (e.g. for media upload / re-typing)
 * without relying on array position.
 */

const blockId = z.string().min(1);

export const ParagraphBlock = z.object({
  id: blockId,
  type: z.literal("paragraph"),
  /** Raw text with inline markup tokens: **bold**, ==highlight==, __underline__ */
  text: z.string(),
});

export const HeadingBlock = z.object({
  id: blockId,
  type: z.literal("heading"),
  text: z.string(),
});

export const DividerBlock = z.object({
  id: blockId,
  type: z.literal("divider"),
});

export const ImagePlaceholderBlock = z.object({
  id: blockId,
  type: z.literal("image_placeholder"),
  /** Korean guidance text describing what photo to place here (not a search query). */
  imageQuery: z.string(),
  /** Set once the user uploads a real file in the draft review screen. */
  filePath: z.string().optional(),
});

export const VideoPlaceholderBlock = z.object({
  id: blockId,
  type: z.literal("video_placeholder"),
  imageQuery: z.string(),
  filePath: z.string().optional(),
});

export const EmoticonPlaceholderBlock = z.object({
  id: blockId,
  type: z.literal("emoticon_placeholder"),
  /** Short Korean search term for finding a matching Naver sticker. */
  imageQuery: z.string(),
});

export const LinkBlock = z.object({
  id: blockId,
  type: z.literal("link_block"),
  kind: z.enum(["talktalk", "related_post", "reservation"]),
  label: z.string(),
  url: z.string(),
});

export const HashtagsBlock = z.object({
  id: blockId,
  type: z.literal("hashtags"),
  tags: z.array(z.string()),
});

export const Block = z.discriminatedUnion("type", [
  ParagraphBlock,
  HeadingBlock,
  DividerBlock,
  ImagePlaceholderBlock,
  VideoPlaceholderBlock,
  EmoticonPlaceholderBlock,
  LinkBlock,
  HashtagsBlock,
]);
export type Block = z.infer<typeof Block>;

export const BlockList = z.array(Block);
export type BlockList = z.infer<typeof BlockList>;

/**
 * The subset of block types the AI is ever allowed to produce. Greeting,
 * Talktalk, reservation, related-post, and hashtags are always assembled
 * by code (see assemblePost) — the AI must never author a link_block.
 */
export const AiBodyBlock = z.discriminatedUnion("type", [
  ParagraphBlock,
  HeadingBlock,
  DividerBlock,
  ImagePlaceholderBlock,
  VideoPlaceholderBlock,
  EmoticonPlaceholderBlock,
]);
export type AiBodyBlock = z.infer<typeof AiBodyBlock>;

export const AiBodyBlockList = z.array(AiBodyBlock);
export type AiBodyBlockList = z.infer<typeof AiBodyBlockList>;
