import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getNaverSession } from "./repo.js";
import { enqueueNaverLogin } from "../automation/naverLogin.js";
import { automationQueue } from "../automation/queue.js";

export const naverSessionRouter = Router();

naverSessionRouter.get("/status", (_req, res) => {
  res.json({ ...getNaverSession(), queueSize: automationQueue.size, queuePending: automationQueue.pending });
});

naverSessionRouter.post("/login", (_req, res) => {
  const runId = randomUUID();
  // Fire-and-forget: the client subscribes to GET /api/events/:runId for
  // live progress and re-polls /status once it sees a "done" event.
  // Errors are already published to the progress bus inside runNaverLogin,
  // so a rejection here would only happen for a bug outside that try/catch.
  enqueueNaverLogin(runId).catch((err) => {
    console.error("[naver-login] unexpected failure outside the login flow's own error handling:", err);
  });
  res.status(202).json({ runId });
});
