import { v4 as uuidv4 } from "uuid";
import type { AiBodyBlockList, Block, BusinessProfileRecord, PostType } from "@app/shared";

export interface AssemblePostInput {
  prewrittenContent: string;
  relatedPostTitle: string;
  relatedPostUrl: string;
}

/**
 * Pure function — the fixed template assembly. Never touches Playwright or
 * the AI SDK, so it's reusable from both the manual generate path and the
 * scheduler path.
 *
 * 홍보성: 인사말 → 톡톡 → AI 본문 → 직접쓴글(줄바꿈=문단) → 예약 link_block →
 * 관련글 link_block → 해시태그.
 *
 * 정보성 (per user decision — 광고색을 진하게 만들 요소는 뺀다): 인사말 → AI
 * 본문 → 직접쓴글 → 해시태그만. 톡톡/예약/관련글은 붙이지 않는다 — 홈피드
 * 노출을 노리는 글에 영업 느낌이 섞이면 역효과라는 이유.
 *
 * Any step whose source field is empty is simply omitted (e.g. no
 * reservation URL registered yet -> no reservation block), rather than
 * inserting an empty placeholder.
 */
export function assemblePost(
  profile: BusinessProfileRecord,
  request: AssemblePostInput,
  aiBodyBlocks: AiBodyBlockList,
  postType: PostType,
): Block[] {
  const blocks: Block[] = [];

  if (profile.greeting.trim()) {
    blocks.push({ id: uuidv4(), type: "paragraph", text: profile.greeting.trim() });
  }

  if (postType === "promotional" && profile.talktalkUrl.trim()) {
    blocks.push({
      id: uuidv4(),
      type: "link_block",
      kind: "talktalk",
      label: "궁금한 점은 네이버 톡톡으로 편하게 문의해주세요",
      url: profile.talktalkUrl.trim(),
    });
  }

  blocks.push(...aiBodyBlocks);

  if (request.prewrittenContent.trim()) {
    for (const line of request.prewrittenContent.split("\n")) {
      if (line.trim()) {
        blocks.push({ id: uuidv4(), type: "paragraph", text: line.trim() });
      }
    }
  }

  if (postType === "promotional") {
    if (profile.reservationUrl.trim()) {
      blocks.push({
        id: uuidv4(),
        type: "link_block",
        kind: "reservation",
        label: profile.name.trim() ? `${profile.name.trim()} 예약/오시는 길 안내` : "예약/오시는 길 안내",
        url: profile.reservationUrl.trim(),
      });
    }

    if (request.relatedPostTitle.trim() && request.relatedPostUrl.trim()) {
      blocks.push({
        id: uuidv4(),
        type: "link_block",
        kind: "related_post",
        label: request.relatedPostTitle.trim(),
        url: request.relatedPostUrl.trim(),
      });
    }
  }

  const tags = profile.hashtags
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tags.length) {
    blocks.push({ id: uuidv4(), type: "hashtags", tags });
  }

  return blocks;
}
