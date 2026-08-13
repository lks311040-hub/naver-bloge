-- Initial schema. Status enum values must stay in sync with
-- shared/src/status.ts POST_STATUSES.

CREATE TABLE IF NOT EXISTS business_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  strengths TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  greeting TEXT NOT NULL DEFAULT '',
  talktalk_url TEXT NOT NULL DEFAULT '',
  reservation_url TEXT NOT NULL DEFAULT '',
  style_sample TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Seed the singleton row so the app can always UPDATE (never has to
-- distinguish "no profile yet" from "empty profile").
INSERT OR IGNORE INTO business_profile (id, created_at, updated_at)
  VALUES (1, datetime('now'), datetime('now'));

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  topic_params TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  keyword TEXT NOT NULL DEFAULT '',
  highlight_content TEXT NOT NULL DEFAULT '',
  prewritten_content TEXT NOT NULL DEFAULT '',
  related_post_title TEXT NOT NULL DEFAULT '',
  related_post_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN (
    'queued', 'generating', 'review_pending', 'ready',
    'filling', 'filled_awaiting_publish', 'published', 'failed'
  )),
  content_blocks TEXT NOT NULL DEFAULT '[]',
  schema_version INTEGER NOT NULL DEFAULT 1,
  char_count INTEGER,
  keyword_count INTEGER,
  qa_warning TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'scheduled')),
  schedule_id TEXT REFERENCES schedules(id) ON DELETE SET NULL,
  published_url TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);

CREATE TABLE IF NOT EXISTS publish_history (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  published_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  blog_id TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS naver_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  blog_id TEXT,
  storage_state_path TEXT,
  logged_in_at TEXT,
  last_verified_at TEXT
);

CREATE TABLE IF NOT EXISTS keyword_ideas (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
