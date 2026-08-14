/**
 * Standalone check for proposeTopic() — the "글감 큐가 비었을 때 AI가 스스로
 * 정보성 글 주제를 고르는" path. Calls it directly (no DB/scheduler
 * involved) so it's cheap to verify in isolation.
 *
 * Usage: npx tsx scripts/test-propose-topic.ts
 */
import { proposeTopic } from "../src/modules/ai/proposeTopic.js";
import type { BusinessProfileRecord } from "@app/shared";

const SAMPLE_PROFILE: BusinessProfileRecord = {
  name: "아첼음악학원",
  address: "경기 시흥시 승지로60번길 25 센타프라자 5층",
  strengths: "20년 레슨경력, 6세부터 80세까지, 1:1 맞춤 과외식 레슨",
  notes: "",
  greeting: "",
  talktalkUrl: "",
  reservationUrl: "",
  styleSample: "",
  hashtags: "",
  updatedAt: "",
};

async function main() {
  const topic = await proposeTopic({
    profile: SAMPLE_PROFILE,
    avoidTopics: ["디지털 피아노 vs 어쿠스틱 피아노", "피아노 몇 살부터 시작해야 할까"],
  });
  console.log("proposed topic:", topic);
}

main().catch((err) => {
  console.error("failed:", err);
  process.exit(1);
});
