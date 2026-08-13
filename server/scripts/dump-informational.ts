/**
 * Quality-review helper — prints a full informational draft's title + body
 * text (not just the pass/fail stats test-generate-draft.ts gives) so a
 * human can actually read it and judge whether it matches the 6가지
 * 홈피드형 스타일 규칙 (see promptInformational.ts).
 *
 * Usage: npx tsx scripts/dump-informational.ts ["주제 키워드"]
 */
import { generateDraft } from "../src/modules/ai/generateDraft.js";
import type { BusinessProfileRecord } from "@app/shared";

const SAMPLE_PROFILE: BusinessProfileRecord = {
  name: "테스트어학원",
  address: "서울특별시 강남구 테스트로 123",
  strengths: "10년차 원어민 강사진, 학생 개별 맞춤 레벨테스트, 소규모 그룹 수업(최대 6명)",
  notes: "",
  greeting: "",
  talktalkUrl: "",
  reservationUrl: "",
  styleSample: "",
  hashtags: "",
  updatedAt: "",
};

const keyword = process.argv[2] ?? "초등학생 영어 조기교육";

async function main() {
  const result = await generateDraft({
    postType: "informational",
    title: "",
    keyword,
    highlightContent: "",
    profile: SAMPLE_PROFILE,
  });

  console.log("=== 제목 ===");
  console.log(result.title);
  console.log(`\n=== 본문 (${result.charCount}자) ===\n`);
  for (const block of result.blocks) {
    if (block.type === "heading") console.log(`\n### ${block.text}\n`);
    else if (block.type === "paragraph") console.log(block.text);
    else if (block.type === "divider") console.log("\n---\n");
    else console.log(`[${block.type}: ${"imageQuery" in block ? block.imageQuery : ""}]`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
