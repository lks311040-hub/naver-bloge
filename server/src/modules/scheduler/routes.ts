import { Router } from "express";
import { ScheduleRequestObjectSchema, ScheduleRequestSchema } from "@app/shared";
import { createSchedule, deleteSchedule, getSchedule, listSchedules, updateSchedule } from "./repo.js";
import { runScheduleNow, syncTask, unregisterTask } from "./runner.js";

export const schedulerRouter = Router();

schedulerRouter.get("/", (_req, res) => {
  res.json(listSchedules());
});

schedulerRouter.get("/:id", (req, res) => {
  const schedule = getSchedule(req.params.id);
  if (!schedule) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(schedule);
});

schedulerRouter.post("/", (req, res) => {
  const parsed = ScheduleRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  const schedule = createSchedule(parsed.data);
  syncTask(schedule.id);
  res.status(201).json(schedule);
});

schedulerRouter.patch("/:id", (req, res) => {
  const parsed = ScheduleRequestObjectSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  const existing = getSchedule(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  // Only apply the fields the caller actually sent. `.partial()` makes
  // every field optional, but zod still runs each field's `.default(...)`
  // for any key left `undefined` — so parsed.data silently comes back with
  // e.g. topicSource/title/keyword/highlightContent force-filled with their
  // schema defaults even though the caller only meant to flip `enabled`.
  // Spreading the whole of parsed.data over `existing` was clobbering the
  // rest of the record on every single-field PATCH (observed live: toggling
  // "enabled" alone silently reset a queue-mode schedule back to
  // topicSource "fixed"). Only keys present in the raw request body are
  // real intent to change.
  const sentKeys = Object.keys(req.body ?? {});
  const patch: Record<string, unknown> = {};
  for (const key of sentKeys) {
    if (key in parsed.data) patch[key] = (parsed.data as Record<string, unknown>)[key];
  }
  const merged = { ...existing, ...patch };
  const schedule = updateSchedule(req.params.id!, merged);
  syncTask(req.params.id!);
  res.json(schedule);
});

schedulerRouter.delete("/:id", (req, res) => {
  unregisterTask(req.params.id!);
  deleteSchedule(req.params.id!);
  res.status(204).end();
});

schedulerRouter.post("/:id/run-now", (req, res) => {
  const schedule = getSchedule(req.params.id);
  if (!schedule) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  runScheduleNow(req.params.id!).catch((err) => {
    console.error("[scheduler] run-now failed:", err);
  });
  res.status(202).json({ ok: true });
});
