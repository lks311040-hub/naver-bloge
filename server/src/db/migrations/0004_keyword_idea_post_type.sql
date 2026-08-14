-- 글감도 홍보성/정보성으로 나눠서 등록할 수 있도록. 기존 행은 정보성으로
-- 간주 (지금까지 큐는 정보성 전용이었으므로 안전한 기본값).
ALTER TABLE keyword_ideas ADD COLUMN post_type TEXT NOT NULL DEFAULT 'informational'
  CHECK (post_type IN ('promotional', 'informational'));
CREATE INDEX IF NOT EXISTS idx_keyword_ideas_post_type_used ON keyword_ideas(post_type, used_at);
