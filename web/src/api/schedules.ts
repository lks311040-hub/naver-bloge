import type { ScheduleRecord, ScheduleRequest } from "@app/shared";
import { apiFetch } from "./client";

export function fetchSchedules(): Promise<ScheduleRecord[]> {
  return apiFetch<ScheduleRecord[]>("/api/schedules");
}

export function createSchedule(data: ScheduleRequest): Promise<ScheduleRecord> {
  return apiFetch<ScheduleRecord>("/api/schedules", { method: "POST", body: JSON.stringify(data) });
}

export function updateSchedule(id: string, data: Partial<ScheduleRequest>): Promise<ScheduleRecord> {
  return apiFetch<ScheduleRecord>(`/api/schedules/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteSchedule(id: string): Promise<void> {
  const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`삭제 실패: HTTP ${res.status}`);
}

export function runScheduleNow(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/schedules/${id}/run-now`, { method: "POST" });
}
