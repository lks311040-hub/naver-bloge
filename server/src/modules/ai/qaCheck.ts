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

const CHAR_MIN = 2800;
const CHAR_MAX = 3200;
const IMAGE_COUNT = 3;
const VIDEO_COUNT = 2;
const EMOTICON_COUNT = 2;
const DIVIDER_COUNT = 4;
const HEADING_MIN = 3;
const HEADING_MAX = 4;

/**
 * Structural self-check the AI module runs after every draft (initial and
 * corrected). Mirrors the counting rules in shared/src/markup.ts so the
 * same definitions (markup-stripped char count, etc.) apply everywhere.
 */
export function runQaCheck(blocks: AiBodyBlockList, keyword: string): QaCheckResult {
  const issues: string[] = [];

  const charCount = countVisibleChars(blocks);
  if (charCount < CHAR_MIN) {
    issues.push(
      `글자수가 ${charCount}자로 부족합니다 (목표 ${CHAR_MIN}~${CHAR_MAX}자). 문단 "개수"를 늘려서 최소 ${CHAR_MIN - charCount}자 이상 더 채우세요.`,
    );
  } else if (charCount > CHAR_MAX) {
    issues.push(
      `글자수가 ${charCount}자로 초과했습니다 (목표 ${CHAR_MIN}~${CHAR_MAX}자). ${charCount - CHAR_MAX}자 이상 줄이세요.`,
    );
  }

  const trimmedKeyword = keyword.trim();
  const keywordCount = trimmedKeyword ? countKeywordOccurrences(blocks, trimmedKeyword) : 0;
  if (trimmedKeyword && keywordCount !== 4) {
    issues.push(
      `타겟 키워드 "${trimmedKeyword}"가 본문에 ${keywordCount}번 등장합니다. 정확히 4번이 되도록 자연스럽게 추가/제거하세요.`,
    );
  }

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

  const headingCount = countBlocksByType(blocks, "heading");
  if (headingCount < HEADING_MIN || headingCount > HEADING_MAX) {
    issues.push(`소제목(heading)이 ${headingCount}개입니다. ${HEADING_MIN}~${HEADING_MAX}개 사이여야 합니다.`);
  }

  return { ok: issues.length === 0, issues, charCount, keywordCount };
}
