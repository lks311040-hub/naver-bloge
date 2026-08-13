import type { ScheduleRecord } from "@app/shared";
import { createAndGenerate } from "../posts/service.js";

/**
 * The entire scheduled-job body. Deliberately touches nothing but
 * posts/service.js (db + AI + pure assembly) — see .dependency-cruiser.cjs
 * for the enforced rule that this module (and everything under
 * modules/scheduler) can never import modules/automation, structurally
 * ruling out auto-publish rather than just relying on convention.
 */
export async function generateScheduledDraft(schedule: ScheduleRecord): Promise<void> {
  await createAndGenerate(
    {
      // Scheduling is scoped to 홍보성 posts only for now — informational
      // posts need a human picking a topic that actually fits a real
      // event/issue, which doesn't suit a recurring unattended cron job.
      postType: "promotional",
      title: schedule.title,
      keyword: schedule.keyword,
      highlightContent: schedule.highlightContent,
      prewrittenContent: "",
      relatedPostTitle: "",
      relatedPostUrl: "",
    },
    { source: "scheduled", scheduleId: schedule.id },
  );
}
