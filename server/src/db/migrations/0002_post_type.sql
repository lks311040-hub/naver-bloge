-- 홍보성/정보성 글 구분. Values must stay in sync with shared/src/status.ts POST_TYPES.
ALTER TABLE posts ADD COLUMN post_type TEXT NOT NULL DEFAULT 'promotional'
  CHECK (post_type IN ('promotional', 'informational'));

CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);
