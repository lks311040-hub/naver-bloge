-- 글 하단에 붙는 톡톡/예약/주소 링크를 글 종류별로 켜고 끌 수 있게 한다.
-- 지금까지는 assemble.ts 안에 "홍보성이면 톡톡+예약, 정보성이면 없음"이
-- 하드코딩돼 있었는데, 정보성 글에도 붙이고 싶다는 요구가 생겨서 업체 정보에
-- 설정으로 뺐다.
--
-- DEFAULT 값은 이 마이그레이션 이전 동작을 그대로 재현한다 — 기존 사용자가
-- 아무것도 안 건드려도 결과물이 달라지지 않아야 하므로:
--   홍보성: 톡톡 켬, 예약 켬 / 정보성: 전부 끔 / 주소는 새 항목이라 전부 끔.
-- shared/src/business-profile.ts 의 DEFAULT_ATTACHMENTS 와 값이 같아야 한다.
ALTER TABLE business_profile ADD COLUMN attach_promo_talktalk INTEGER NOT NULL DEFAULT 1;
ALTER TABLE business_profile ADD COLUMN attach_promo_reservation INTEGER NOT NULL DEFAULT 1;
ALTER TABLE business_profile ADD COLUMN attach_promo_address INTEGER NOT NULL DEFAULT 0;
ALTER TABLE business_profile ADD COLUMN attach_info_talktalk INTEGER NOT NULL DEFAULT 0;
ALTER TABLE business_profile ADD COLUMN attach_info_reservation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE business_profile ADD COLUMN attach_info_address INTEGER NOT NULL DEFAULT 0;

-- 기존 `address` 컬럼은 AI 프롬프트에 넣는 사람이 읽는 주소 문자열이라
-- 그대로 두고, 글에 붙일 지도/플레이스 링크는 별도 컬럼으로 받는다.
ALTER TABLE business_profile ADD COLUMN address_url TEXT NOT NULL DEFAULT '';
