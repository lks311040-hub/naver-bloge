import { z } from "zod";

/**
 * A recurring "글감 준비 → AI 초안 작성" job. Firing NEVER touches
 * Playwright/automation — the resulting draft always lands as
 * status: review_pending, same as a manual generation, and a human still
 * has to review/approve/autofill/publish it by hand. See
 * server/src/modules/scheduler for the structural (not just conventional)
 * enforcement of that boundary.
 */
export const ScheduleRequestSchema = z.object({
  name: z.string().min(1, "예약 이름을 입력하세요"),
  cronExpression: z.string().min(1, "cron 표현식을 입력하세요"),
  timezone: z.string().default("Asia/Seoul"),
  title: z.string().min(1, "글 제목을 입력하세요"),
  keyword: z.string().default(""),
  highlightContent: z.string().default(""),
  enabled: z.boolean().default(true),
});
export type ScheduleRequest = z.infer<typeof ScheduleRequestSchema>;

export const ScheduleRecordSchema = ScheduleRequestSchema.extend({
  id: z.string(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ScheduleRecord = z.infer<typeof ScheduleRecordSchema>;
