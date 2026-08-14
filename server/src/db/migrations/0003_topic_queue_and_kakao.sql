-- 글감 큐 소비 추적 (schedules가 keyword_ideas를 순서대로 소비할 수 있도록).
ALTER TABLE keyword_ideas ADD COLUMN used_at TEXT;
ALTER TABLE keyword_ideas ADD COLUMN used_by_post_id TEXT REFERENCES posts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_keyword_ideas_used_at ON keyword_ideas(used_at);

-- schedules: 어떤 글 종류를 만들지, 글감을 고정 주제로 쓸지 큐/AI 자동선정으로 쓸지.
-- topic_source='fixed'  -> 기존 방식 그대로 topic_params의 title/keyword 고정 사용 (홍보성).
-- topic_source='queue'  -> 매 실행마다 keyword_ideas 큐에서 다음 항목 소비, 없으면 AI가 스스로 주제를 선정 (정보성).
ALTER TABLE schedules ADD COLUMN post_type TEXT NOT NULL DEFAULT 'promotional'
  CHECK (post_type IN ('promotional', 'informational'));
ALTER TABLE schedules ADD COLUMN topic_source TEXT NOT NULL DEFAULT 'fixed'
  CHECK (topic_source IN ('fixed', 'queue'));

-- 카카오톡 "나에게 보내기" 알림 연동 — 네이버 세션과 동일하게 싱글턴 1행.
CREATE TABLE IF NOT EXISTS kakao_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TEXT,
  connected_at TEXT
);

-- 카카오 개발자 앱의 REST API 키/시크릿 (사장님이 developers.kakao.com에서
-- 직접 발급받아 대시보드 설정 화면에서 입력). 코드에 하드코딩하지 않는다.
CREATE TABLE IF NOT EXISTS kakao_app_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rest_api_key TEXT NOT NULL DEFAULT '',
  client_secret TEXT NOT NULL DEFAULT '',
  updated_at TEXT
);
