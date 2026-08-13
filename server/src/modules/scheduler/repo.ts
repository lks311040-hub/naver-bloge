import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db/connection.js";
import type { ScheduleRecord, ScheduleRequest } from "@app/shared";

interface ScheduleRow {
  id: string;
  name: string;
  cron_expression: string;
  timezone: string;
  topic_params: string;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
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
    title: topic.title,
    keyword: topic.keyword,
    highlightContent: topic.highlightContent,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `id, name, cron_expression, timezone, topic_params, enabled, last_run_at, next_run_at, created_at, updated_at`;

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
      `INSERT INTO schedules (id, name, cron_expression, timezone, topic_params, enabled, created_at, updated_at)
       VALUES (@id, @name, @cronExpression, @timezone, @topicParams, @enabled, datetime('now'), datetime('now'))`,
    )
    .run({
      id,
      name: input.name,
      cronExpression: input.cronExpression,
      timezone: input.timezone,
      topicParams: JSON.stringify(topicParams),
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
