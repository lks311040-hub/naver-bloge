import { z } from "zod";
import { BlockList } from "./blocks.js";
import { POST_SOURCES, POST_STATUSES, POST_TYPES } from "./status.js";

/**
 * Payload for POST /api/posts/generate — the "새 글 작성" form fields.
 *
 * `title` and `keyword` are conditionally required depending on `postType`
 * (see the superRefine below): a 홍보성 post needs an exact title (used
 * verbatim, never touched by AI); a 정보성 post needs a topic keyword
 * instead — its title is AI-generated to be click-inducing, so `title` is
 * left blank by the form and filled in by the server after generation.
 */
export const PostRequestSchema = z
  .object({
    postType: z.enum(POST_TYPES).default("promotional"),
    title: z.string().default(""),
    keyword: z.string().default(""),
    highlightContent: z.string().default(""),
    /** Pre-written text, verbatim, one line = one paragraph. Never touched by AI. */
    prewrittenContent: z.string().default(""),
    relatedPostTitle: z.string().default(""),
    relatedPostUrl: z.string().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.postType === "promotional" && !data.title.trim()) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "홍보성 글은 제목을 입력하세요" });
    }
    if (data.postType === "informational" && !data.keyword.trim()) {
      ctx.addIssue({ code: "custom", path: ["keyword"], message: "정보성 글은 주제 키워드를 입력하세요" });
    }
  });
export type PostRequest = z.infer<typeof PostRequestSchema>;

export const PostRecordSchema = z.object({
  id: z.string(),
  postType: z.enum(POST_TYPES),
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
