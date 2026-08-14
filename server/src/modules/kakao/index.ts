export { kakaoRouter } from "./routes.js";

import { sendKakaoMemo } from "./client.js";
import { getKakaoSession } from "./repo.js";

/**
 * Best-effort notification — swallows every failure (not connected, token
 * expired past recovery, Kakao API down, etc.) and just logs it. A
 * notification failing must never fail the actual scheduled generation it's
 * reporting on; the draft is already safely sitting in 초안 review either
 * way, notification or not.
 */
export async function notifyKakao(text: string, linkUrl?: string): Promise<void> {
  const session = getKakaoSession();
  if (!session.accessToken) return; // not connected — silently skip, not an error
  try {
    await sendKakaoMemo(text, linkUrl);
  } catch (err) {
    console.error("[kakao] notify failed (non-fatal):", err instanceof Error ? err.message : err);
  }
}
