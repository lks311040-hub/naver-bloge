import {
  countBlocksByType,
  countKeywordOccurrences,
  countVisibleChars,
  type AiBodyBlockList,
} from "@app/shared";

export interface QaCheckResult {
  ok: boolean;
  issues: string[];
  charCount: number;
  keywordCount: number;
}

const IMAGE_COUNT = 3;
const VIDEO_COUNT = 2;
const EMOTICON_COUNT = 2;
const DIVIDER_COUNT = 4;

const PROMO_CHAR_MIN = 2500;
const PROMO_CHAR_MAX = 3200;
const PROMO_HEADING_MIN = 3;
const PROMO_HEADING_MAX = 4;

const INFO_CHAR_MIN = 2200;
const INFO_CHAR_MAX = 3200;
const INFO_HEADING_COUNT = 3;

function checkMediaCounts(blocks: AiBodyBlockList, issues: string[]): void {
  const imageCount = countBlocksByType(blocks, "image_placeholder");
  if (imageCount !== IMAGE_COUNT) {
    issues.push(`image_placeholder가 ${imageCount}개입니다. 정확히 ${IMAGE_COUNT}개여야 합니다.`);
  }
  const videoCount = countBlocksByType(blocks, "video_placeholder");
  if (videoCount !== VIDEO_COUNT) {
    issues.push(`video_placeholder가 ${videoCount}개입니다. 정확히 ${VIDEO_COUNT}개여야 합니다.`);
  }
  const emoticonCount = countBlocksByType(blocks, "emoticon_placeholder");
  if (emoticonCount !== EMOTICON_COUNT) {
    issues.push(`emoticon_placeholder가 ${emoticonCount}개입니다. 정확히 ${EMOTICON_COUNT}개여야 합니다.`);
  }
  const dividerCount = countBlocksByType(blocks, "divider");
  if (dividerCount !== DIVIDER_COUNT) {
    issues.push(`구분선(divider)이 ${dividerCount}개입니다. 정확히 ${DIVIDER_COUNT}개여야 합니다.`);
  }
}

/**
 * Structural self-check for 홍보성 posts, run after every draft (initial and
 * corrected). Mirrors the counting rules in shared/src/markup.ts so the
 * same definitions (markup-stripped char count, etc.) apply everywhere.
 */
export function runPromotionalQaCheck(blocks: AiBodyBlockList, keyword: string): QaCheckResult {
  const issues: string[] = [];

  const charCount = countVisibleChars(blocks);
  if (charCount < PROMO_CHAR_MIN) {
    issues.push(
      `글자수가 ${charCount}자로 부족합니다 (목표 ${PROMO_CHAR_MIN}~${PROMO_CHAR_MAX}자). 문단 "개수"를 늘려서 최소 ${PROMO_CHAR_MIN - charCount}자 이상 더 채우세요.`,
    );
  } else if (charCount > PROMO_CHAR_MAX) {
    issues.push(
      `글자수가 ${charCount}자로 초과했습니다 (목표 ${PROMO_CHAR_MIN}~${PROMO_CHAR_MAX}자). ${charCount - PROMO_CHAR_MAX}자 이상 줄이세요.`,
    );
  }

  const trimmedKeyword = keyword.trim();
  const keywordCount = trimmedKeyword ? countKeywordOccurrences(blocks, trimmedKeyword) : 0;
  if (trimmedKeyword && keywordCount !== 4) {
    issues.push(
      `타겟 키워드 "${trimmedKeyword}"가 본문에 ${keywordCount}번 등장합니다. 정확히 4번이 되도록 자연스럽게 추가/제거하세요.`,
    );
  }

  checkMediaCounts(blocks, issues);

  const headingCount = countBlocksByType(blocks, "heading");
  if (headingCount < PROMO_HEADING_MIN || headingCount > PROMO_HEADING_MAX) {
    issues.push(`소제목(heading)이 ${headingCount}개입니다. ${PROMO_HEADING_MIN}~${PROMO_HEADING_MAX}개 사이여야 합니다.`);
  }

  return { ok: issues.length === 0, issues, charCount, keywordCount };
}

/**
 * Structural self-check for 정보성 posts. Deliberately does NOT gate on an
 * exact keyword count (the user's brief only asked for natural mentions,
 * unlike 홍보성's explicit "정확히 4번") — keywordCount is still computed and
 * reported for visibility, just never fails the check. Things like "주관적
 * 해석 최소 4회" from the style brief aren't checked here at all: there's no
 * reliable way to count that programmatically, so it's enforced only via
 * the prompt instructions and the model's own self-check.
 */
export function runInformationalQaCheck(blocks: AiBodyBlockList, keyword: string): QaCheckResult {
  const issues: string[] = [];

  const charCount = countVisibleChars(blocks);
  if (charCount < INFO_CHAR_MIN) {
    issues.push(
      `글자수가 ${charCount}자로 부족합니다 (목표 ${INFO_CHAR_MIN}~${INFO_CHAR_MAX}자). 문단 개수를 늘려서 최소 ${INFO_CHAR_MIN - charCount}자 이상 더 채우세요.`,
    );
  } else if (charCount > INFO_CHAR_MAX) {
    issues.push(
      `글자수가 ${charCount}자로 초과했습니다 (목표 ${INFO_CHAR_MIN}~${INFO_CHAR_MAX}자). ${charCount - INFO_CHAR_MAX}자 이상 줄이세요.`,
    );
  }

  const trimmedKeyword = keyword.trim();
  const keywordCount = trimmedKeyword ? countKeywordOccurrences(blocks, trimmedKeyword) : 0;

  checkMediaCounts(blocks, issues);

  const headingCount = countBlocksByType(blocks, "heading");
  if (headingCount !== INFO_HEADING_COUNT) {
    issues.push(`소제목(heading)이 ${headingCount}개입니다. 정확히 ${INFO_HEADING_COUNT}개여야 합니다.`);
  }

  return { ok: issues.length === 0, issues, charCount, keywordCount };
}
