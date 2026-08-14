import { z } from "zod";
import { POST_TYPES } from "./status.js";

/** How a schedule picks its topic each time it fires.
 * `fixed` — same title/keyword every run (the original behavior; only makes
 *   sense for 홍보성, where a human-chosen title is required).
 * `queue` — every firing consumes the next unused item from the 글감
 *   메모장 (keyword_ideas); if the queue is empty, the AI proposes its own
 *   fresh topic instead. Always produces 정보성 posts (keyword-driven, AI
 *   writes its own title) — a fixed promotional title can't be auto-picked
 *   sensibly, but a keyword-only informational topic can.
 */
export const TOPIC_SOURCES = ["fixed", "queue"] as const;
export type TopicSource = (typeof TOPIC_SOURCES)[number];

/**
 * A recurring "글감 준비 → AI 초안 작성" job. Firing NEVER touches
 * Playwright/automation — the resulting draft always lands as
 * status: review_pending, same as a manual generation, and a human still
 * has to review/approve/autofill/publish it by hand. See
 * server/src/modules/scheduler for the structural (not just conventional)
 * enforcement of that boundary.
 */
export const ScheduleRequestSchema = z
  .object({
    name: z.string().min(1, "예약 이름을 입력하세요"),
    cronExpression: z.string().min(1, "cron 표현식을 입력하세요"),
    timezone: z.string().default("Asia/Seoul"),
    postType: z.enum(POST_TYPES).default("promotional"),
    topicSource: z.enum(TOPIC_SOURCES).default("fixed"),
    title: z.string().default(""),
    keyword: z.string().default(""),
    highlightContent: z.string().default(""),
    enabled: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    // Fixed-topic schedules need the same info a manual post of that type
    // needs. Queue-sourced schedules ignore title/keyword entirely (a fresh
    // one is picked every firing), so nothing to validate there.
    if (data.topicSource === "fixed" && data.postType === "promotional" && !data.title.trim()) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "고정 주제 홍보성 예약은 제목을 입력하세요" });
    }
    if (data.topicSource === "fixed" && data.postType === "informational" && !data.keyword.trim()) {
      ctx.addIssue({ code: "custom", path: ["keyword"], message: "고정 주제 정보성 예약은 주제 키워드를 입력하세요" });
    }
  });
export type ScheduleRequest = z.infer<typeof ScheduleRequestSchema>;

export const ScheduleRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  cronExpression: z.string(),
  timezone: z.string(),
  postType: z.enum(POST_TYPES),
  topicSource: z.enum(TOPIC_SOURCES),
  title: z.string(),
  keyword: z.string(),
  highlightContent: z.string(),
  enabled: z.boolean(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ScheduleRecord = z.infer<typeof ScheduleRecordSchema>;
