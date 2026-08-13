/**
 * M3 acceptance check: calls generateDraft() directly (no Express/DB) a few
 * times with a fixed sample input and reports whether each draft lands
 * within the 2800~3200자 / keyword=4 / title-exact-match spec.
 *
 * Usage: npm run test:ai -w server -- [runs]  (default 3 runs)
 */
import { generateDraft } from "../src/modules/ai/generateDraft.js";
import { countBlocksByType } from "@app/shared";
import type { BusinessProfileRecord } from "@app/shared";

const SAMPLE_PROFILE: BusinessProfileRecord = {
  name: "테스트어학원",
  address: "서울특별시 강남구 테스트로 123",
  strengths: "10년차 원어민 강사진, 학생 개별 맞춤 레벨테스트, 소규모 그룹 수업(최대 6명)",
  notes: "매년 3월/9월에 신학기 설명회를 진행합니다.",
  greeting: "",
  talktalkUrl: "",
  reservationUrl: "",
  styleSample: "",
  hashtags: "",
  updatedAt: "",
};

const SAMPLE_INPUT = {
  title: "강남 초등영어학원, 우리 아이에게 맞는 곳일까요?",
  keyword: "강남초등영어학원",
  highlightContent: "이번 달 신규 등록 학생 대상 레벨테스트 무료 진행",
  profile: SAMPLE_PROFILE,
};

const runs = Number(process.argv[2] ?? 3);

async function main() {
  console.log(`[test-generate-draft] running ${runs}회...\n`);
  let allOk = true;

  for (let i = 1; i <= runs; i++) {
    const start = Date.now();
    const result = await generateDraft(SAMPLE_INPUT);
    const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

    const headingCount = countBlocksByType(result.blocks, "heading");
    const dividerCount = countBlocksByType(result.blocks, "divider");
    const imageCount = countBlocksByType(result.blocks, "image_placeholder");
    const videoCount = countBlocksByType(result.blocks, "video_placeholder");
    const emoticonCount = countBlocksByType(result.blocks, "emoticon_placeholder");

    const lengthOk = result.charCount >= 2800 && result.charCount <= 3200;
    const keywordOk = result.keywordCount === 4;
    const ok = lengthOk && keywordOk && !result.qaWarning;
    allOk &&= ok;

    console.log(
      `[run ${i}/${runs}] ${elapsedSec}s ${ok ? "✅ PASS" : "⚠️  WARN"}\n` +
        `  글자수: ${result.charCount} (${lengthOk ? "OK" : "범위 밖"})\n` +
        `  키워드 등장: ${result.keywordCount} (${keywordOk ? "OK" : "4회 아님"})\n` +
        `  구조: heading=${headingCount} divider=${dividerCount} image=${imageCount} video=${videoCount} emoticon=${emoticonCount}\n` +
        `  qaWarning: ${result.qaWarning ?? "(없음)"}\n`,
    );
  }

  console.log(allOk ? "전체 통과" : "일부 런에서 qa 경고 발생 — 위 로그 확인");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("[test-generate-draft] 실패:", err);
  process.exit(1);
});
