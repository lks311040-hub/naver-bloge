import { z } from "zod";
import { POST_TYPES } from "./status.js";

/**
 * 글감 메모장 — 수동으로 적어둔 주제 후보 목록. 홍보성/정보성을 나눠서
 * 등록한다 (홍보성 글감은 그대로 글 제목으로 쓰이고, 정보성 글감은 AI가
 * 제목을 새로 짓는 "주제 키워드"로 쓰인다). topicSource: 'queue'인 예약이
 * 실행될 때마다, 그 예약의 postType과 같은 글감 중 오래된 순으로 하나씩
 * 소비된다 (used_at이 채워짐).
 */
export const KeywordIdeaRequestSchema = z.object({
  postType: z.enum(POST_TYPES).default("informational"),
  text: z.string().min(1, "글감을 입력하세요"),
  memo: z.string().default(""),
});
export type KeywordIdeaRequest = z.infer<typeof KeywordIdeaRequestSchema>;

export const KeywordIdeaRecordSchema = z.object({
  id: z.string(),
  postType: z.enum(POST_TYPES),
  text: z.string(),
  memo: z.string(),
  usedAt: z.string().nullable(),
  usedByPostId: z.string().nullable(),
  createdAt: z.string(),
});
export type KeywordIdeaRecord = z.infer<typeof KeywordIdeaRecordSchema>;
