import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db/connection.js";
import type { Block, PostRecord, PostRequest, PostStatus, PostSource } from "@app/shared";

interface PostRow {
  id: string;
  title: string;
  keyword: string;
  highlight_content: string;
  prewritten_content: string;
  related_post_title: string;
  related_post_url: string;
  status: string;
  content_blocks: string;
  char_count: number | null;
  keyword_count: number | null;
  qa_warning: string | null;
  source: string;
  schedule_id: string | null;
  published_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: PostRow): PostRecord {
  return {
    id: row.id,
    title: row.title,
    keyword: row.keyword,
    highlightContent: row.highlight_content,
    prewrittenContent: row.prewritten_content,
    relatedPostTitle: row.related_post_title,
    relatedPostUrl: row.related_post_url,
    status: row.status as PostStatus,
    blocks: JSON.parse(row.content_blocks) as Block[],
    charCount: row.char_count,
    keywordCount: row.keyword_count,
    qaWarning: row.qa_warning,
    source: row.source as PostSource,
    scheduleId: row.schedule_id,
    publishedUrl: row.published_url,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `id, title, keyword, highlight_content, prewritten_content,
  related_post_title, related_post_url, status, content_blocks, char_count,
  keyword_count, qa_warning, source, schedule_id, published_url, published_at, created_at, updated_at`;

export function createPost(
  request: PostRequest,
  opts: { status: PostStatus; source: PostSource; scheduleId?: string },
): PostRecord {
  const id = uuidv4();
  getDb()
    .prepare(
      `INSERT INTO posts (
         id, title, keyword, highlight_content, prewritten_content,
         related_post_title, related_post_url, status, content_blocks,
         source, schedule_id, created_at, updated_at
       ) VALUES (
         @id, @title, @keyword, @highlightContent, @prewrittenContent,
         @relatedPostTitle, @relatedPostUrl, @status, '[]',
         @source, @scheduleId, datetime('now'), datetime('now')
       )`,
    )
    .run({ id, ...request, status: opts.status, source: opts.source, scheduleId: opts.scheduleId ?? null });
  return getPost(id)!;
}

export function getPost(id: string): PostRecord | undefined {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM posts WHERE id = ?`)
    .get(id) as PostRow | undefined;
  return row ? rowToRecord(row) : undefined;
}

export function listPosts(status?: PostStatus): PostRecord[] {
  const rows = status
    ? (getDb()
        .prepare(`SELECT ${SELECT_COLUMNS} FROM posts WHERE status = ? ORDER BY created_at DESC`)
        .all(status) as PostRow[])
    : (getDb()
        .prepare(`SELECT ${SELECT_COLUMNS} FROM posts ORDER BY created_at DESC`)
        .all() as PostRow[]);
  return rows.map(rowToRecord);
}

export interface CompleteGenerationInput {
  blocks: Block[];
  charCount: number;
  keywordCount: number;
  qaWarning: string | null;
  relatedPostTitle: string;
  relatedPostUrl: string;
}

export function completeGeneration(id: string, input: CompleteGenerationInput): void {
  getDb()
    .prepare(
      `UPDATE posts SET
         status = 'review_pending',
         content_blocks = @blocks,
         char_count = @charCount,
         keyword_count = @keywordCount,
         qa_warning = @qaWarning,
         related_post_title = @relatedPostTitle,
         related_post_url = @relatedPostUrl,
         updated_at = datetime('now')
       WHERE id = @id`,
    )
    .run({
      id,
      blocks: JSON.stringify(input.blocks),
      charCount: input.charCount,
      keywordCount: input.keywordCount,
      qaWarning: input.qaWarning,
      relatedPostTitle: input.relatedPostTitle,
      relatedPostUrl: input.relatedPostUrl,
    });
}

export function updateBlocks(id: string, blocks: Block[]): void {
  getDb()
    .prepare(`UPDATE posts SET content_blocks = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(blocks), id);
}

export function approvePost(id: string): void {
  getDb()
    .prepare(`UPDATE posts SET status = 'ready', updated_at = datetime('now') WHERE id = ?`)
    .run(id);
}

export function markPostFailed(id: string, reason: string): void {
  getDb()
    .prepare(
      `UPDATE posts SET status = 'failed', qa_warning = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(reason, id);
}

export function markPostGenerating(id: string): void {
  // Clears qa_warning for the same reason markPostFilling does — a retry
  // must not leave a stale failure message around if it succeeds.
  getDb()
    .prepare(`UPDATE posts SET status = 'generating', qa_warning = NULL, updated_at = datetime('now') WHERE id = ?`)
    .run(id);
}

export function markPostFilling(id: string): void {
  // Clears qa_warning: it's shared with markPostFailed's failure reason, so
  // a fresh attempt must not leave a stale error from a previous failed run
  // sitting there if this attempt succeeds.
  getDb()
    .prepare(`UPDATE posts SET status = 'filling', qa_warning = NULL, updated_at = datetime('now') WHERE id = ?`)
    .run(id);
}

export function markPostFilledAwaitingPublish(id: string): void {
  getDb()
    .prepare(
      `UPDATE posts SET status = 'filled_awaiting_publish', updated_at = datetime('now') WHERE id = ?`,
    )
    .run(id);
}

/** Pure DB write — the human already published manually in the still-open
 * browser window; this never touches Playwright. */
export function markPostPublished(id: string, publishedUrl: string): PostRecord | undefined {
  getDb()
    .prepare(
      `UPDATE posts SET status = 'published', published_url = ?, published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    )
    .run(publishedUrl, id);
  return getPost(id);
}

/** Used to auto-resolve "함께 읽으면 좋은 글" when the request leaves it blank. */
export function getLatestPublished(): { title: string; url: string } | undefined {
  const row = getDb()
    .prepare(
      `SELECT title, published_url FROM posts
       WHERE status = 'published' AND published_url IS NOT NULL
       ORDER BY published_at DESC LIMIT 1`,
    )
    .get() as { title: string; published_url: string } | undefined;
  return row ? { title: row.title, url: row.published_url } : undefined;
}
