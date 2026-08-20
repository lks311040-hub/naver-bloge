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
 * `promotional` — the original flow: user-given title used verbatim, full
 * fixed template (greeting/talktalk/reservation/related-post/hashtags)
 * wrapped around the AI body.
 * `informational` — 홈피드-style content aimed at organic reach rather than
 * a sales pitch: only a topic keyword is required, the AI generates its own
 * click-inducing title, and only greeting+hashtags are wrapped around the
 * body (no talktalk/reservation/related-post — see assemble.ts).
 */
export const POST_TYPES = ["promotional", "informational"] as const;
export type PostType = (typeof POST_TYPES)[number];
