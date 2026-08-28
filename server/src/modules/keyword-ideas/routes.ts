import { Router } from "express";
import { z } from "zod";
import { KeywordIdeaRequestSchema } from "@app/shared";
import { createKeywordIdea, deleteKeywordIdea, listKeywordIdeas, markKeywordIdeaUsed } from "./repo.js";

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

// 글감 메모장에서 "이 글감으로 쓰기"로 직접 초안을 만든 경우, 그 글감을 쓴
// 것으로 표시한다. 표시해두지 않으면 나중에 예약(큐)이 같은 글감을 또 꺼내
// 써서 같은 주제의 글이 두 번 만들어진다.
const MarkUsedSchema = z.object({ postId: z.string().min(1) });

keywordIdeasRouter.post("/:id/used", (req, res) => {
  const parsed = MarkUsedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  const updated = markKeywordIdeaUsed(req.params.id!, parsed.data.postId);
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(updated);
});

keywordIdeasRouter.delete("/:id", (req, res) => {
  deleteKeywordIdea(req.params.id!);
  res.status(204).end();
});
