import { getDb } from "../../db/connection.js";

export interface NaverSessionInfo {
  blogId: string | null;
  storageStatePath: string | null;
  loggedInAt: string | null;
}

interface NaverSessionRow {
  blog_id: string | null;
  storage_state_path: string | null;
  logged_in_at: string | null;
}

/** naver_session is a singleton (id fixed to 1), not seeded — absent until first login. */
export function getNaverSession(): NaverSessionInfo {
  const row = getDb()
    .prepare(`SELECT blog_id, storage_state_path, logged_in_at FROM naver_session WHERE id = 1`)
    .get() as NaverSessionRow | undefined;
  return row
    ? { blogId: row.blog_id, storageStatePath: row.storage_state_path, loggedInAt: row.logged_in_at }
    : { blogId: null, storageStatePath: null, loggedInAt: null };
}

export function saveNaverSession(input: { blogId: string; storageStatePath: string }): void {
  getDb()
    .prepare(
      `INSERT INTO naver_session (id, blog_id, storage_state_path, logged_in_at, last_verified_at)
       VALUES (1, @blogId, @storageStatePath, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         blog_id = excluded.blog_id,
         storage_state_path = excluded.storage_state_path,
         logged_in_at = excluded.logged_in_at,
         last_verified_at = excluded.last_verified_at`,
    )
    .run(input);
}
