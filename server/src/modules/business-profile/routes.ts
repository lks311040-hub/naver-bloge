import { Router } from "express";
import { BusinessProfileSchema } from "@app/shared";
import { getBusinessProfile, updateBusinessProfile } from "./repo.js";

export const businessProfileRouter = Router();

businessProfileRouter.get("/", (_req, res) => {
  res.json(getBusinessProfile());
});

businessProfileRouter.put("/", (req, res) => {
  const parsed = BusinessProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  res.json(updateBusinessProfile(parsed.data));
});
