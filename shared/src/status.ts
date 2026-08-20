/**
 * Post lifecycle status. Drives both the Drafts list filters and the
 * autofill state machine. `failed` can be reached from `generating` or
 * `filling` on unrecoverable errors.
 */
export const POST_STATUSES = [
  "queued",
  "generating",
  "review_pending",
  "ready",
  "filling",
  "filled_awaiting_publish",
  "published",
  "failed",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_SOURCES = ["manual", "scheduled"] as const;
export type PostSource = (typeof POST_SOURCES)[number];

/**
 * `promotional` — the original flow: user-given title used verbatim, and the
 * related-post link is only ever attached to this type.
 * `informational` — 홈피드-style content aimed at organic reach rather than
 * a sales pitch: only a topic keyword is required and the AI generates its
 * own click-inducing title.
 *
 * 두 종류 모두 인사말+해시태그는 항상 붙고, 톡톡/예약/주소 링크는 업체 정보의
 * `attachments` 설정에 따라 종류별로 붙거나 안 붙는다 (assemble.ts 참고).
 * 예전에는 "정보성엔 톡톡/예약을 절대 안 붙인다"가 코드에 고정돼 있었으나
 * 지금은 운영자가 대시보드에서 정한다.
 */
export const POST_TYPES = ["promotional", "informational"] as const;
export type PostType = (typeof POST_TYPES)[number];
