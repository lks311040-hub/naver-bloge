import { z } from "zod";

/**
 * 글감 메모장 — 수동으로 적어둔 주제 후보 목록. topicSource: 'queue'인
 * 예약이 실행될 때마다 오래된 순으로 하나씩 소비된다 (used_at이 채워짐).
 * 소비되지 않은 항목만 새 글감으로 선택 대상이 된다.
 */
export const KeywordIdeaRequestSchema = z.object({
  text: z.string().min(1, "글감을 입력하세요"),
  memo: z.string().default(""),
});
export type KeywordIdeaRequest = z.infer<typeof KeywordIdeaRequestSchema>;

export const KeywordIdeaRecordSchema = z.object({
  id: z.string(),
  text: z.string(),
  memo: z.string(),
  usedAt: z.string().nullable(),
  usedByPostId: z.string().nullable(),
  createdAt: z.string(),
});
export type KeywordIdeaRecord = z.infer<typeof KeywordIdeaRecordSchema>;
