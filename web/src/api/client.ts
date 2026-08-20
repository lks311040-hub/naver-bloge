/** Thin fetch wrapper — throws on non-2xx so react-query's error state picks it up. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 서버가 { message } 를 실어 보내면 그 문장을 그대로 보여준다 — 사람이 읽고
    // 바로 조치할 수 있는 안내인 경우가 많다. 아니면 기존처럼 경로+상태코드를
    // 남겨서 개발 중 디버깅이 가능하게 한다.
    let friendly = "";
    try {
      friendly = String(JSON.parse(body)?.message ?? "");
    } catch {
      /* JSON이 아니면 무시 */
    }
    throw new Error(friendly || `${init?.method ?? "GET"} ${path} -> HTTP ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}
