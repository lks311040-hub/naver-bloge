import { apiFetch } from "./client";

export interface NaverStatus {
  blogId: string | null;
  storageStatePath: string | null;
  loggedInAt: string | null;
  queueSize: number;
  queuePending: number;
}

export function fetchNaverStatus(): Promise<NaverStatus> {
  return apiFetch<NaverStatus>("/api/naver/status");
}

export function startNaverLogin(): Promise<{ runId: string }> {
  return apiFetch<{ runId: string }>("/api/naver/login", { method: "POST" });
}
