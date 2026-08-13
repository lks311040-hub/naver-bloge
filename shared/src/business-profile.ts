import { z } from "zod";

/**
 * Registered once, reused on every post. Consumed by:
 *  - server/src/modules/business-profile (DB row <-> this shape)
 *  - web business-profile form (react-hook-form + zodResolver against this)
 *  - server/src/modules/posts/assemble.ts (greeting/talktalk/reservation/hashtags
 *    insertion — the AI never sees or writes these fields directly, they're
 *    only ever code-assembled)
 *
 * `hashtags` is stored/edited as a single space-separated string (e.g.
 * "#영어학원 #강남어학원") and split into an array only at assembly time.
 */
export const BusinessProfileSchema = z.object({
  name: z.string(),
  address: z.string(),
  strengths: z.string(),
  notes: z.string(),
  greeting: z.string(),
  talktalkUrl: z.string(),
  reservationUrl: z.string(),
  styleSample: z.string(),
  hashtags: z.string(),
});
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

export const BusinessProfileRecordSchema = BusinessProfileSchema.extend({
  updatedAt: z.string(),
});
export type BusinessProfileRecord = z.infer<typeof BusinessProfileRecordSchema>;
