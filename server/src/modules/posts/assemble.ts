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
 * 순서: 인사말 → 톡톡 → AI 본문 → 직접쓴글(줄바꿈=문단) → 예약 → 주소 →
 * 관련글 → 해시태그.
 *
 * 톡톡/예약/주소 세 가지는 글 종류별로 켜고 끌 수 있다
 * (`profile.attachments[postType]`, 업체 정보 화면의 "글 종류별 첨부 요소"
 * 대시보드에서 설정). 예전에는 "홍보성이면 붙이고 정보성이면 안 붙인다"가
 * 여기 하드코딩돼 있었는데, 정보성 글에도 붙이고 싶다는 요구가 생겨 설정으로
 * 뺐다. 기본값은 예전 동작과 같다 (shared/src/business-profile.ts 의
 * DEFAULT_ATTACHMENTS 참고).
 *
 * 관련글 링크만은 여전히 홍보성 전용이다 — 업체 정보가 아니라 글마다 따로
 * 입력받는 값이라 대시보드로 관리할 대상이 아니다.
 *
 * Any step whose source field is empty is simply omitted (e.g. no
 * reservation URL registered yet -> no reservation block), rather than
 * inserting an empty placeholder. 토글이 켜져 있어도 URL이 비면 마찬가지다.
 */
export function assemblePost(
  profile: BusinessProfileRecord,
  request: AssemblePostInput,
  aiBodyBlocks: AiBodyBlockList,
  postType: PostType,
): Block[] {
  const blocks: Block[] = [];
  const attach = profile.attachments[postType];
  const businessName = profile.name.trim();

  if (profile.greeting.trim()) {
    blocks.push({ id: uuidv4(), type: "paragraph", text: profile.greeting.trim() });
  }

  if (attach.talktalk && profile.talktalkUrl.trim()) {
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

  if (attach.reservation && profile.reservationUrl.trim()) {
    // 주소 링크를 따로 붙이는 경우엔 예약 쪽 문구에서 "오시는 길"을 빼서
    // 두 블록의 안내가 겹치지 않게 한다.
    const suffix = attach.address ? "예약 안내" : "예약/오시는 길 안내";
    blocks.push({
      id: uuidv4(),
      type: "link_block",
      kind: "reservation",
      label: businessName ? `${businessName} ${suffix}` : suffix,
      url: profile.reservationUrl.trim(),
    });
  }

  if (attach.address && profile.addressUrl.trim()) {
    blocks.push({
      id: uuidv4(),
      type: "link_block",
      kind: "address",
      label: businessName ? `${businessName} 오시는 길` : "오시는 길",
      url: profile.addressUrl.trim(),
    });
  }

  if (postType === "promotional" && request.relatedPostTitle.trim() && request.relatedPostUrl.trim()) {
    blocks.push({
      id: uuidv4(),
      type: "link_block",
      kind: "related_post",
      label: request.relatedPostTitle.trim(),
      url: request.relatedPostUrl.trim(),
    });
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
