import express from "express";
import cors from "cors";
import { runMigrations } from "./db/migrate.js";
import { ensureDataDirs, UPLOADS_DIR } from "./config/paths.js";
import { businessProfileRouter } from "./modules/business-profile/index.js";
import { postsRouter } from "./modules/posts/index.js";
import { naverSessionRouter } from "./modules/naver-session/index.js";
import { sseRouter } from "./modules/sse/index.js";
import { schedulerRouter, startScheduler } from "./modules/scheduler/index.js";

ensureDataDirs();
runMigrations();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "naver-blog-automation-server" });
});

app.use("/api/business-profile", businessProfileRouter);
app.use("/api/posts", postsRouter);
app.use("/api/naver", naverSessionRouter);
app.use("/api/events", sseRouter);
app.use("/api/schedules", schedulerRouter);
app.use("/media", express.static(UPLOADS_DIR));

startScheduler();

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
