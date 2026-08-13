import { Router } from "express";
import { ScheduleRequestSchema } from "@app/shared";
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
  const parsed = ScheduleRequestSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  const existing = getSchedule(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const merged = { ...existing, ...parsed.data };
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
