import { getDb } from "../../db/connection.js";

export interface KakaoAppConfig {
  restApiKey: string;
  clientSecret: string;
}

export interface KakaoSession {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
}

export function getKakaoAppConfig(): KakaoAppConfig {
  const row = getDb()
    .prepare(`SELECT rest_api_key, client_secret FROM kakao_app_config WHERE id = 1`)
    .get() as { rest_api_key: string; client_secret: string } | undefined;
  return { restApiKey: row?.rest_api_key ?? "", clientSecret: row?.client_secret ?? "" };
}

export function setKakaoAppConfig(config: KakaoAppConfig): void {
  getDb()
    .prepare(
      `INSERT INTO kakao_app_config (id, rest_api_key, client_secret, updated_at)
       VALUES (1, @restApiKey, @clientSecret, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET rest_api_key = @restApiKey, client_secret = @clientSecret, updated_at = datetime('now')`,
    )
    .run(config);
}

export function getKakaoSession(): KakaoSession {
  const row = getDb()
    .prepare(`SELECT access_token, refresh_token, token_expires_at, connected_at FROM kakao_session WHERE id = 1`)
    .get() as
    | { access_token: string | null; refresh_token: string | null; token_expires_at: string | null; connected_at: string | null }
    | undefined;
  return {
    accessToken: row?.access_token ?? null,
    refreshToken: row?.refresh_token ?? null,
    tokenExpiresAt: row?.token_expires_at ?? null,
    connectedAt: row?.connected_at ?? null,
  };
}

export function saveKakaoTokens(accessToken: string, refreshToken: string, expiresInSec: number): void {
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
  getDb()
    .prepare(
      `INSERT INTO kakao_session (id, access_token, refresh_token, token_expires_at, connected_at)
       VALUES (1, @accessToken, @refreshToken, @expiresAt, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         access_token = @accessToken,
         refresh_token = @refreshToken,
         token_expires_at = @expiresAt,
         connected_at = COALESCE(kakao_session.connected_at, datetime('now'))`,
    )
    .run({ accessToken, refreshToken, expiresAt });
}

/** Refresh-token-only update — Kakao doesn't always issue a new refresh
 * token on refresh, so keep the old one when it doesn't. */
export function saveKakaoAccessToken(accessToken: string, expiresInSec: number, newRefreshToken?: string): void {
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
  const db = getDb();
  if (newRefreshToken) {
    db.prepare(`UPDATE kakao_session SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = 1`).run(
      accessToken,
      newRefreshToken,
      expiresAt,
    );
  } else {
    db.prepare(`UPDATE kakao_session SET access_token = ?, token_expires_at = ? WHERE id = 1`).run(
      accessToken,
      expiresAt,
    );
  }
}

export function clearKakaoSession(): void {
  getDb().prepare(`DELETE FROM kakao_session WHERE id = 1`).run();
}
