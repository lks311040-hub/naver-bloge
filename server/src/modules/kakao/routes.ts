import { Router } from "express";
import { z } from "zod";
import { buildAuthorizeUrl, exchangeCodeForTokens, sendKakaoMemo } from "./client.js";
import { clearKakaoSession, getKakaoAppConfig, getKakaoSession, setKakaoAppConfig } from "./repo.js";

export const kakaoRouter = Router();

const FRONTEND_URL = "http://localhost:5173";

const KakaoConfigSchema = z.object({
  restApiKey: z.string().min(1, "REST API 키를 입력하세요"),
  clientSecret: z.string().default(""),
});

// Never echoes clientSecret back in full — only whether one is set — so it
// doesn't round-trip in plaintext to the browser on every page load.
kakaoRouter.get("/config", (_req, res) => {
  const config = getKakaoAppConfig();
  res.json({ restApiKey: config.restApiKey, hasClientSecret: config.clientSecret.length > 0 });
});

kakaoRouter.put("/config", (req, res) => {
  const parsed = KakaoConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  setKakaoAppConfig(parsed.data);
  res.json({ ok: true });
});

kakaoRouter.get("/status", (_req, res) => {
  const config = getKakaoAppConfig();
  const session = getKakaoSession();
  res.json({
    configured: config.restApiKey.length > 0,
    connected: Boolean(session.accessToken && session.refreshToken),
    connectedAt: session.connectedAt,
  });
});

// Opens in the operator's own browser (a plain link on the dashboard, not
// automation) — she completes the Kakao login/consent herself, exactly
// like the Naver login flow. This server never sees her Kakao password.
kakaoRouter.get("/login", (_req, res) => {
  const config = getKakaoAppConfig();
  if (!config.restApiKey) {
    res.status(400).send("카카오 REST API 키가 설정되지 않았습니다. 대시보드 설정 화면에서 먼저 입력해주세요.");
    return;
  }
  res.redirect(buildAuthorizeUrl());
});

kakaoRouter.get("/callback", (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;
  if (error) {
    res.redirect(`${FRONTEND_URL}/?kakao=denied`);
    return;
  }
  if (!code) {
    res.status(400).send("인가 코드가 없습니다.");
    return;
  }
  exchangeCodeForTokens(code)
    .then(() => res.redirect(`${FRONTEND_URL}/?kakao=connected`))
    .catch((err) => {
      console.error("[kakao] token exchange failed:", err);
      res.redirect(`${FRONTEND_URL}/?kakao=error`);
    });
});

kakaoRouter.post("/disconnect", (_req, res) => {
  clearKakaoSession();
  res.json({ ok: true });
});

kakaoRouter.post("/test", (_req, res) => {
  sendKakaoMemo("네이버 블로그 자동화 테스트 알림입니다. 이 메시지가 보이면 연결이 정상입니다 🎹")
    .then(() => res.json({ ok: true }))
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    });
});
