import type { KeywordIdeaRecord, KeywordIdeaRequest } from "@app/shared";
import { apiFetch } from "./client";

export function fetchKeywordIdeas(): Promise<KeywordIdeaRecord[]> {
  return apiFetch<KeywordIdeaRecord[]>("/api/keyword-ideas");
}

export function createKeywordIdea(data: KeywordIdeaRequest): Promise<KeywordIdeaRecord> {
  return apiFetch<KeywordIdeaRecord>("/api/keyword-ideas", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteKeywordIdea(id: string): Promise<void> {
  const res = await fetch(`/api/keyword-ideas/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`삭제 실패: HTTP ${res.status}`);
}
