/** Thin fetch wrapper — throws on non-2xx so react-query's error state picks it up. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${path} -> HTTP ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}
