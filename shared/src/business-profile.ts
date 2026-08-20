import { z } from "zod";

/**
 * 글 하나에 고정으로 붙일 수 있는 "연락/안내" 링크 3종의 on/off.
 * 글 종류(홍보성/정보성)마다 따로 정한다 — 정보성은 홈피드 노출을 노리는
 * 글이라 영업 색이 짙어지는 걸 원치 않을 수 있고, 반대로 붙이고 싶을 수도
 * 있어서 운영자가 대시보드에서 직접 켜고 끈다.
 *
 * 켜져 있어도 해당 URL이 비어 있으면 그냥 생략된다 (assemble.ts).
 */
export const AttachmentTogglesSchema = z.object({
  talktalk: z.boolean(),
  reservation: z.boolean(),
  address: z.boolean(),
});
export type AttachmentToggles = z.infer<typeof AttachmentTogglesSchema>;

export const AttachmentSettingsSchema = z.object({
  promotional: AttachmentTogglesSchema,
  informational: AttachmentTogglesSchema,
});
export type AttachmentSettings = z.infer<typeof AttachmentSettingsSchema>;

/**
 * 기본값은 이 기능이 생기기 전의 동작을 그대로 재현한다: 홍보성은 톡톡+예약이
 * 항상 붙었고, 정보성은 아무것도 안 붙었다. 주소 링크는 새로 생긴 항목이라
 * 양쪽 다 꺼진 상태로 시작한다.
 * DB 쪽 DEFAULT (migration 0006) 와 반드시 같은 값을 유지할 것.
 */
export const DEFAULT_ATTACHMENTS: AttachmentSettings = {
  promotional: { talktalk: true, reservation: true, address: false },
  informational: { talktalk: false, reservation: false, address: false },
};

/**
 * Registered once, reused on every post. Consumed by:
 *  - server/src/modules/business-profile (DB row <-> this shape)
 *  - web business-profile form (react-hook-form, hand-validated — no zodResolver)
 *  - server/src/modules/posts/assemble.ts (greeting/talktalk/reservation/address/
 *    hashtags insertion — the AI never sees or writes these fields directly,
 *    they're only ever code-assembled)
 *
 * `hashtags` is stored/edited as a single space-separated string (e.g.
 * "#영어학원 #강남어학원") and split into an array only at assembly time.
 *
 * `address` 는 AI 프롬프트에 넘기는, 사람이 읽는 주소 문자열이고 `addressUrl`
 * 은 글 하단에 붙이는 네이버 지도/플레이스 링크다 — 서로 별개의 필드다.
 */
export const BusinessProfileSchema = z.object({
  name: z.string(),
  address: z.string(),
  addressUrl: z.string(),
  strengths: z.string(),
  notes: z.string(),
  greeting: z.string(),
  talktalkUrl: z.string(),
  reservationUrl: z.string(),
  styleSample: z.string(),
  hashtags: z.string(),
  attachments: AttachmentSettingsSchema,
});
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

export const BusinessProfileRecordSchema = BusinessProfileSchema.extend({
  updatedAt: z.string(),
});
export type BusinessProfileRecord = z.infer<typeof BusinessProfileRecordSchema>;
