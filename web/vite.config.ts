import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api, /events, and /media to the Express server so the
// browser only ever talks to one origin (http://localhost:5173).
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
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/events": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/media": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
