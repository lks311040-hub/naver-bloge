import { apiFetch } from "./client";

export interface KakaoStatus {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
}

export interface KakaoConfig {
  restApiKey: string;
  hasClientSecret: boolean;
}

export function fetchKakaoStatus(): Promise<KakaoStatus> {
  return apiFetch<KakaoStatus>("/api/kakao/status");
}

export function fetchKakaoConfig(): Promise<KakaoConfig> {
  return apiFetch<KakaoConfig>("/api/kakao/config");
}

export function saveKakaoConfig(data: { restApiKey: string; clientSecret: string }): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/kakao/config", { method: "PUT", body: JSON.stringify(data) });
}

export async function disconnectKakao(): Promise<void> {
  const res = await fetch("/api/kakao/disconnect", { method: "POST" });
  if (!res.ok) throw new Error(`연결 해제 실패: HTTP ${res.status}`);
}

export function sendKakaoTest(): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>("/api/kakao/test", { method: "POST" });
}
