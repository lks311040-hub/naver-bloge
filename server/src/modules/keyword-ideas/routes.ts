import { Router } from "express";
import { KeywordIdeaRequestSchema } from "@app/shared";
import { createKeywordIdea, deleteKeywordIdea, listKeywordIdeas } from "./repo.js";

export const keywordIdeasRouter = Router();

keywordIdeasRouter.get("/", (_req, res) => {
  res.json(listKeywordIdeas());
});

keywordIdeasRouter.post("/", (req, res) => {
  const parsed = KeywordIdeaRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  res.status(201).json(createKeywordIdea(parsed.data));
});

keywordIdeasRouter.delete("/:id", (req, res) => {
  deleteKeywordIdea(req.params.id!);
  res.status(204).end();
});
