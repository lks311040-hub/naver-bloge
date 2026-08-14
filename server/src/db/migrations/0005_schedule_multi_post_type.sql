-- 예약이 홍보성/정보성을 동시에(번갈아가며) 발행할 수 있도록 post_type
-- 단일값 대신 post_types 배열(JSON)을 쓴다. 기존 값은 그대로 1개짜리
-- 배열로 옮겨온다. 옛 post_type 컬럼은 더 이상 쓰이지 않지만 안전하게
-- 남겨둔다 (SQLite 컬럼 삭제는 하지 않음 — 이 프로젝트의 마이그레이션은
-- 항상 추가만 하는 방식).
ALTER TABLE schedules ADD COLUMN post_types TEXT NOT NULL DEFAULT '["promotional"]';
UPDATE schedules SET post_types = '["' || post_type || '"]';

-- 2개 이상 고른 예약이 매 실행마다 번갈아(라운드로빈) 발행하기 위한 상태.
ALTER TABLE schedules ADD COLUMN last_fired_post_type TEXT;
