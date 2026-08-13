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
