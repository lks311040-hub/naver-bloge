import cron, { type ScheduledTask } from "node-cron";
import type { ScheduleRecord } from "@app/shared";
import { getSchedule, listSchedules, touchScheduleRun } from "./repo.js";
import { generateScheduledDraft } from "./generateScheduledDraft.js";

const tasks = new Map<string, ScheduledTask>();

/** Called once at server boot — loads every enabled schedule from the DB. */
export function startScheduler(): void {
  for (const schedule of listSchedules()) {
    if (schedule.enabled) registerTask(schedule);
  }
  console.log(`[scheduler] started, ${tasks.size} active schedule(s)`);
}

/** Re-registers (or removes) a schedule's cron task after CRUD changes,
 * without needing a server restart. */
export function syncTask(scheduleId: string): void {
  unregisterTask(scheduleId);
  const schedule = getSchedule(scheduleId);
  if (schedule?.enabled) registerTask(schedule);
}

export function unregisterTask(scheduleId: string): void {
  const existing = tasks.get(scheduleId);
  if (existing) {
    existing.stop();
    tasks.delete(scheduleId);
  }
}

function registerTask(schedule: ScheduleRecord): void {
  if (!cron.validate(schedule.cronExpression)) {
    console.error(`[scheduler] invalid cron expression for "${schedule.name}": ${schedule.cronExpression}`);
    return;
  }
  const task = cron.schedule(
    schedule.cronExpression,
    () => {
      void runScheduledJob(schedule.id);
    },
    { timezone: schedule.timezone },
  );
  tasks.set(schedule.id, task);
}

async function runScheduledJob(scheduleId: string): Promise<void> {
  const schedule = getSchedule(scheduleId);
  if (!schedule || !schedule.enabled) return;

  const ranAt = new Date().toISOString();
  touchScheduleRun(scheduleId, ranAt);
  console.log(`[scheduler] firing "${schedule.name}" (${scheduleId})`);

  try {
    await generateScheduledDraft(schedule);
  } catch (err) {
    console.error(`[scheduler] "${schedule.name}" failed:`, err);
  }
}

/** Used by the "지금 실행" test button — runs immediately, outside the cron
 * trigger, but through the exact same code path. */
export async function runScheduleNow(scheduleId: string): Promise<void> {
  await runScheduledJob(scheduleId);
}
