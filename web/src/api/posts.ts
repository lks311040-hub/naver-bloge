import type { PostRecord, PostRequest } from "@app/shared";
import { apiFetch } from "./client";

export function generatePost(data: PostRequest): Promise<PostRecord> {
  return apiFetch<PostRecord>("/api/posts/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchPost(id: string): Promise<PostRecord> {
  return apiFetch<PostRecord>(`/api/posts/${id}`);
}

export function fetchPosts(status?: string): Promise<PostRecord[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<PostRecord[]>(`/api/posts${qs}`);
}

export async function uploadBlockMedia(postId: string, blockId: string, file: File): Promise<PostRecord> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/posts/${postId}/media/${blockId}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`업로드 실패: HTTP ${res.status}`);
  return res.json() as Promise<PostRecord>;
}

export function updateLinkBlock(
  postId: string,
  blockId: string,
  patch: { label?: string; url?: string },
): Promise<PostRecord> {
  return apiFetch<PostRecord>(`/api/posts/${postId}/blocks/${blockId}/link`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function approvePost(postId: string): Promise<PostRecord> {
  return apiFetch<PostRecord>(`/api/posts/${postId}/approve`, { method: "POST" });
}

export function autofillPost(postId: string): Promise<{ runId: string }> {
  return apiFetch<{ runId: string }>(`/api/posts/${postId}/autofill`, { method: "POST" });
}

export function markPostPublished(postId: string, publishedUrl: string): Promise<PostRecord> {
  return apiFetch<PostRecord>(`/api/posts/${postId}/mark-published`, {
    method: "POST",
    body: JSON.stringify({ publishedUrl }),
  });
}
