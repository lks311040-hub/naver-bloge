import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db/connection.js";
import type { KeywordIdeaRecord, KeywordIdeaRequest, PostType } from "@app/shared";

interface KeywordIdeaRow {
  id: string;
  post_type: PostType;
  text: string;
  memo: string;
  used_at: string | null;
  used_by_post_id: string | null;
  created_at: string;
}

function rowToRecord(row: KeywordIdeaRow): KeywordIdeaRecord {
  return {
    id: row.id,
    postType: row.post_type,
    text: row.text,
    memo: row.memo,
    usedAt: row.used_at,
    usedByPostId: row.used_by_post_id,
    createdAt: row.created_at,
  };
}

const SELECT_COLUMNS = `id, post_type, text, memo, used_at, used_by_post_id, created_at`;

/** All ideas, newest first — used-up ones included so the memo page can
 * still show history rather than silently dropping consumed entries. */
export function listKeywordIdeas(): KeywordIdeaRecord[] {
  const rows = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM keyword_ideas ORDER BY created_at DESC`)
    .all() as KeywordIdeaRow[];
  return rows.map(rowToRecord);
}

export function createKeywordIdea(input: KeywordIdeaRequest): KeywordIdeaRecord {
  const id = uuidv4();
  getDb()
    .prepare(
      `INSERT INTO keyword_ideas (id, post_type, text, memo, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    .run(id, input.postType, input.text, input.memo);
  const row = getDb().prepare(`SELECT ${SELECT_COLUMNS} FROM keyword_ideas WHERE id = ?`).get(id) as KeywordIdeaRow;
  return rowToRecord(row);
}

export function deleteKeywordIdea(id: string): void {
  getDb().prepare(`DELETE FROM keyword_ideas WHERE id = ?`).run(id);
}

/**
 * Consumes the oldest not-yet-used idea of the given post type (queue =
 * FIFO by created_at, scoped to postType so a 홍보성 schedule never
 * accidentally grabs a 정보성 idea or vice versa) and marks it used,
 * atomically, so two concurrent schedule firings can never both grab the
 * same idea. Returns undefined when that type's queue is empty — the
 * caller (scheduler) falls back to an AI-proposed topic in that case.
 *
 * The resulting post doesn't exist yet at consume time (generation hasn't
 * even started), so used_by_post_id starts null — call
 * linkKeywordIdeaToPost() once the post id is known, purely for the audit
 * trail (the queue behavior itself only depends on used_at).
 */
export function consumeNextKeywordIdea(postType: PostType): { id: string; text: string } | undefined {
  const db = getDb();
  const consume = db.transaction((): { id: string; text: string } | undefined => {
    const next = db
      .prepare(
        `SELECT id, text FROM keyword_ideas WHERE post_type = ? AND used_at IS NULL ORDER BY created_at ASC LIMIT 1`,
      )
      .get(postType) as { id: string; text: string } | undefined;
    if (!next) return undefined;
    db.prepare(`UPDATE keyword_ideas SET used_at = datetime('now') WHERE id = ?`).run(next.id);
    return next;
  });
  return consume();
}

export function linkKeywordIdeaToPost(ideaId: string, postId: string): void {
  getDb().prepare(`UPDATE keyword_ideas SET used_by_post_id = ? WHERE id = ?`).run(postId, ideaId);
}
