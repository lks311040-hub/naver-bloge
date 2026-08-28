import type { KeywordIdeaRecord, KeywordIdeaRequest } from "@app/shared";
import { apiFetch } from "./client";

export function fetchKeywordIdeas(): Promise<KeywordIdeaRecord[]> {
  return apiFetch<KeywordIdeaRecord[]>("/api/keyword-ideas");
}

export function createKeywordIdea(data: KeywordIdeaRequest): Promise<KeywordIdeaRecord> {
  return apiFetch<KeywordIdeaRecord>("/api/keyword-ideas", { method: "POST", body: JSON.stringify(data) });
}

/** 글감 메모장에서 직접 초안을 만들었을 때 그 글감을 사용됨으로 표시. */
export function markKeywordIdeaUsed(id: string, postId: string): Promise<KeywordIdeaRecord> {
  return apiFetch<KeywordIdeaRecord>(`/api/keyword-ideas/${id}/used`, {
    method: "POST",
    body: JSON.stringify({ postId }),
  });
}

export async function deleteKeywordIdea(id: string): Promise<void> {
  const res = await fetch(`/api/keyword-ideas/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`삭제 실패: HTTP ${res.status}`);
}
