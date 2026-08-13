import { z } from "zod";
import { BlockList } from "./blocks.js";
import { POST_SOURCES, POST_STATUSES } from "./status.js";

/** Payload for POST /api/posts/generate — the "새 글 작성" form fields. */
export const PostRequestSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요"),
  keyword: z.string().default(""),
  highlightContent: z.string().default(""),
  /** Pre-written text, verbatim, one line = one paragraph. Never touched by AI. */
  prewrittenContent: z.string().default(""),
  relatedPostTitle: z.string().default(""),
  relatedPostUrl: z.string().default(""),
});
export type PostRequest = z.infer<typeof PostRequestSchema>;

export const PostRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  keyword: z.string(),
  highlightContent: z.string(),
  prewrittenContent: z.string(),
  relatedPostTitle: z.string(),
  relatedPostUrl: z.string(),
  status: z.enum(POST_STATUSES),
  blocks: BlockList,
  charCount: z.number().nullable(),
  keywordCount: z.number().nullable(),
  qaWarning: z.string().nullable(),
  source: z.enum(POST_SOURCES),
  scheduleId: z.string().nullable(),
  publishedUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PostRecord = z.infer<typeof PostRecordSchema>;
