import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api, /events, and /media to the Express server so the
// browser only ever talks to one origin (http://localhost:5173).
//
// 서버 포트는 PORT 환경변수로 바꿀 수 있으므로(server/src/index.ts) 프록시
// 대상도 같이 따라가게 한다 — 원본 체크아웃의 앱(:4000)을 켜둔 채로 워크트리에서
// 두 번째 인스턴스를 띄워 비교할 때 필요하다:
//   PORT=4001 API_PORT=4001 npm run dev
// 안 주면 기존과 똑같이 4000을 본다.
const API_TARGET = `http://localhost:${process.env.API_PORT ?? 4000}`;

export default defineConfig({
  // Explicit so this config works regardless of the invoking process's cwd
  // (Vite's `root` defaults to process.cwd(), not the config file's own
  // location) — the root dev script invokes this directly from the repo
  // root rather than via `npm run dev -w web`.
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
      "/events": {
        target: API_TARGET,
        changeOrigin: true,
      },
      "/media": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
