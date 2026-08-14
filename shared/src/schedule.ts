import { z } from "zod";
import { POST_TYPES } from "./status.js";

/** How a schedule picks its topic each time it fires.
 * `fixed` — same title/keyword every run (only allowed when exactly one
 *   글 종류 is selected — a single fixed title/keyword can't sensibly serve
 *   two different post types).
 * `queue` — every firing consumes the next unused item from the 글감
 *   메모장 (keyword_ideas, scoped to whichever postType is firing this
 *   time); if that queue is empty, the AI proposes its own fresh topic
 *   instead.
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
 *
 * `postTypes` can hold both "promotional" and "informational" — when it
 * does, each firing alternates (round-robin) between them so e.g. a
 * Mon/Tue/Thu/Fri schedule can produce 2 홍보성 + 2 정보성 a week from one
 * single schedule instead of needing two separate ones.
 */
// The plain object shape, kept separate from the superRefine-wrapped
// version below — zod v4 throws ("`.partial()` cannot be used on object
// schemas containing refinements") if you call `.partial()` on a
// superRefine-wrapped schema. server/src/modules/scheduler/routes.ts's PATCH
// handler needs a partial schema (only a subset of fields, e.g. just
// `enabled`, gets sent), so it builds that off this base object instead of
// off ScheduleRequestSchema — meaning a PATCH's per-field shape isn't
// re-checked against the cross-field rules below (postTypes count vs
// topicSource, etc). That's fine: the route always merges the partial patch
// onto the existing full record and passes the merged object to
// updateSchedule() unconditionally, so nothing partial ever reaches the DB.
export const ScheduleRequestObjectSchema = z.object({
  name: z.string().min(1, "예약 이름을 입력하세요"),
  cronExpression: z.string().min(1, "cron 표현식을 입력하세요"),
  timezone: z.string().default("Asia/Seoul"),
  postTypes: z.array(z.enum(POST_TYPES)).min(1, "글 종류를 하나 이상 선택하세요"),
  topicSource: z.enum(TOPIC_SOURCES).default("fixed"),
  title: z.string().default(""),
  keyword: z.string().default(""),
  highlightContent: z.string().default(""),
  enabled: z.boolean().default(true),
});

export const ScheduleRequestSchema = ScheduleRequestObjectSchema.superRefine((data, ctx) => {
    if (data.postTypes.length > 1 && data.topicSource === "fixed") {
      ctx.addIssue({
        code: "custom",
        path: ["topicSource"],
        message: "글 종류를 2개 이상 선택했다면 '글감 큐 사용'만 고를 수 있어요 (고정 주제는 1개만 가능)",
      });
    }
    // Fixed-topic schedules need the same info a manual post of that type
    // needs. Queue-sourced schedules ignore title/keyword entirely (a fresh
    // one is picked every firing), so nothing to validate there.
    if (data.topicSource === "fixed" && data.postTypes[0] === "promotional" && !data.title.trim()) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "고정 주제 홍보성 예약은 제목을 입력하세요" });
    }
    if (data.topicSource === "fixed" && data.postTypes[0] === "informational" && !data.keyword.trim()) {
      ctx.addIssue({ code: "custom", path: ["keyword"], message: "고정 주제 정보성 예약은 주제 키워드를 입력하세요" });
    }
  });
export type ScheduleRequest = z.infer<typeof ScheduleRequestSchema>;

export const ScheduleRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  cronExpression: z.string(),
  timezone: z.string(),
  postTypes: z.array(z.enum(POST_TYPES)),
  topicSource: z.enum(TOPIC_SOURCES),
  title: z.string(),
  keyword: z.string(),
  highlightContent: z.string(),
  enabled: z.boolean(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  lastFiredPostType: z.enum(POST_TYPES).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ScheduleRecord = z.infer<typeof ScheduleRecordSchema>;
