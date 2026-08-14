import { getKakaoAppConfig, getKakaoSession, saveKakaoAccessToken, saveKakaoTokens } from "./repo.js";

// Must exactly match a "Redirect URI" registered in the Kakao Developers
// console for this app (앱 설정 > 카카오 로그인 > Redirect URI). Local-only
// by design — this whole program only ever runs on the operator's own PC.
const PORT = Number(process.env.PORT ?? 4000);
export const KAKAO_REDIRECT_URI = `http://localhost:${PORT}/api/kakao/callback`;

// "나에게 보내기" (send-to-me) only needs the talk_message scope, not a
// full "friend list" or profile scope — deliberately minimal.
const KAKAO_SCOPE = "talk_message";

export function buildAuthorizeUrl(): string {
  const { restApiKey } = getKakaoAppConfig();
  const params = new URLSearchParams({
    client_id: restApiKey,
    redirect_uri: KAKAO_REDIRECT_URI,
    response_type: "code",
    scope: KAKAO_SCOPE,
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

interface KakaoTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  token_type: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const { restApiKey, clientSecret } = getKakaoAppConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: restApiKey,
    redirect_uri: KAKAO_REDIRECT_URI,
    code,
  });
  if (clientSecret.trim()) body.set("client_secret", clientSecret);

  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  const data = (await res.json()) as KakaoTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`카카오 토큰 발급 실패: ${data.error_description ?? data.error ?? res.status}`);
  }
  saveKakaoTokens(data.access_token, data.refresh_token ?? "", data.expires_in);
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { restApiKey, clientSecret } = getKakaoAppConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: restApiKey,
    refresh_token: refreshToken,
  });
  if (clientSecret.trim()) body.set("client_secret", clientSecret);

  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  const data = (await res.json()) as KakaoTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`카카오 토큰 갱신 실패: ${data.error_description ?? data.error ?? res.status}`);
  }
  saveKakaoAccessToken(data.access_token, data.expires_in, data.refresh_token);
  return data.access_token;
}

/** Returns a currently-valid access token, refreshing it first if it's
 * expired (or about to be, within a minute) or missing. Throws if the
 * account was never connected — callers should treat that as "not
 * configured yet" rather than a transient failure. */
async function ensureValidAccessToken(): Promise<string> {
  const session = getKakaoSession();
  if (!session.accessToken || !session.refreshToken) {
    throw new Error("카카오톡 알림이 아직 연결되지 않았습니다. 대시보드에서 카카오 연결을 먼저 진행해주세요.");
  }
  const expiresAt = session.tokenExpiresAt ? new Date(session.tokenExpiresAt).getTime() : 0;
  if (Date.now() < expiresAt - 60_000) {
    return session.accessToken;
  }
  return refreshAccessToken(session.refreshToken);
}

/**
 * Sends a "나에게 보내기" (send-to-me) KakaoTalk message — the only
 * KakaoTalk push channel a personal (non-business-verified) Kakao
 * Developers app can use. No friend list, no business account needed.
 */
export async function sendKakaoMemo(text: string, linkUrl?: string): Promise<void> {
  const accessToken = await ensureValidAccessToken();

  const templateObject: Record<string, unknown> = {
    object_type: "text",
    text,
    link: linkUrl ? { web_url: linkUrl, mobile_web_url: linkUrl } : { web_url: "http://localhost:5173", mobile_web_url: "http://localhost:5173" },
  };
  if (linkUrl) {
    templateObject.button_title = "대시보드에서 확인";
  }

  const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`카카오톡 메시지 발송 실패 (${res.status}): ${errText.slice(0, 300)}`);
  }
}
