import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db/connection.js";
import type { PostType, ScheduleRecord, ScheduleRequest } from "@app/shared";

interface ScheduleRow {
  id: string;
  name: string;
  cron_expression: string;
  timezone: string;
  topic_params: string;
  post_types: string;
  topic_source: "fixed" | "queue";
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  last_fired_post_type: PostType | null;
  created_at: string;
  updated_at: string;
}

interface TopicParams {
  title: string;
  keyword: string;
  highlightContent: string;
}

function rowToRecord(row: ScheduleRow): ScheduleRecord {
  const topic = JSON.parse(row.topic_params) as TopicParams;
  return {
    id: row.id,
    name: row.name,
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    postTypes: JSON.parse(row.post_types) as PostType[],
    topicSource: row.topic_source,
    title: topic.title,
    keyword: topic.keyword,
    highlightContent: topic.highlightContent,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    lastFiredPostType: row.last_fired_post_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `id, name, cron_expression, timezone, topic_params, post_types, topic_source, enabled, last_run_at, next_run_at, last_fired_post_type, created_at, updated_at`;

export function listSchedules(): ScheduleRecord[] {
  const rows = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM schedules ORDER BY created_at DESC`)
    .all() as ScheduleRow[];
  return rows.map(rowToRecord);
}

export function getSchedule(id: string): ScheduleRecord | undefined {
  const row = getDb().prepare(`SELECT ${SELECT_COLUMNS} FROM schedules WHERE id = ?`).get(id) as
    | ScheduleRow
    | undefined;
  return row ? rowToRecord(row) : undefined;
}

export function createSchedule(input: ScheduleRequest): ScheduleRecord {
  const id = uuidv4();
  const topicParams: TopicParams = {
    title: input.title,
    keyword: input.keyword,
    highlightContent: input.highlightContent,
  };
  getDb()
    .prepare(
      `INSERT INTO schedules (id, name, cron_expression, timezone, topic_params, post_types, topic_source, enabled, created_at, updated_at)
       VALUES (@id, @name, @cronExpression, @timezone, @topicParams, @postTypes, @topicSource, @enabled, datetime('now'), datetime('now'))`,
    )
    .run({
      id,
      name: input.name,
      cronExpression: input.cronExpression,
      timezone: input.timezone,
      topicParams: JSON.stringify(topicParams),
      postTypes: JSON.stringify(input.postTypes),
      topicSource: input.topicSource,
      enabled: input.enabled ? 1 : 0,
    });
  return getSchedule(id)!;
}

export function updateSchedule(id: string, input: ScheduleRequest): ScheduleRecord | undefined {
  const topicParams: TopicParams = {
    title: input.title,
    keyword: input.keyword,
    highlightContent: input.highlightContent,
  };
  getDb()
    .prepare(
      `UPDATE schedules SET
         name = @name,
         cron_expression = @cronExpression,
         timezone = @timezone,
         topic_params = @topicParams,
         post_types = @postTypes,
         topic_source = @topicSource,
         enabled = @enabled,
         updated_at = datetime('now')
       WHERE id = @id`,
    )
    .run({
      id,
      name: input.name,
      cronExpression: input.cronExpression,
      timezone: input.timezone,
      topicParams: JSON.stringify(topicParams),
      postTypes: JSON.stringify(input.postTypes),
      topicSource: input.topicSource,
      enabled: input.enabled ? 1 : 0,
    });
  return getSchedule(id);
}

export function deleteSchedule(id: string): void {
  getDb().prepare(`DELETE FROM schedules WHERE id = ?`).run(id);
}

export function touchScheduleRun(id: string, ranAt: string): void {
  getDb()
    .prepare(`UPDATE schedules SET last_run_at = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(ranAt, id);
}

export function touchScheduleFiredPostType(id: string, postType: PostType): void {
  getDb().prepare(`UPDATE schedules SET last_fired_post_type = ? WHERE id = ?`).run(postType, id);
}

/**
 * Which postType should fire THIS time. A single-type schedule always
 * returns that type. A two-type schedule alternates (round-robin) off
 * last_fired_post_type, so e.g. a 4-day-a-week schedule with both types
 * checked lands exactly 2+2 rather than clumping randomly.
 */
export function pickNextPostType(schedule: ScheduleRecord): PostType {
  if (schedule.postTypes.length <= 1) return schedule.postTypes[0]!;
  const last = schedule.lastFiredPostType;
  if (!last || !schedule.postTypes.includes(last)) return schedule.postTypes[0]!;
  const idx = schedule.postTypes.indexOf(last);
  return schedule.postTypes[(idx + 1) % schedule.postTypes.length]!;
}
