import { Router } from "express";
import { progressBus, type ProgressEvent } from "./progressBus.js";

export const sseRouter = Router();

sseRouter.get("/:runId", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const { runId } = req.params;
  const onEvent = (event: ProgressEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  progressBus.on(runId!, onEvent);

  // Keep intermediate proxies (and this dev setup's Vite proxy) from idling
  // the connection closed.
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    progressBus.off(runId!, onEvent);
  });
});
