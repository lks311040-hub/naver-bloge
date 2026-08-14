import type { PostRecord, PostRequest, ScheduleRecord } from "@app/shared";
import { createAndGenerate } from "../posts/service.js";
import { getPost, getRecentPostsForDedup } from "../posts/repo.js";
import { getBusinessProfile } from "../business-profile/repo.js";
import { consumeNextKeywordIdea, linkKeywordIdeaToPost } from "../keyword-ideas/index.js";
import { proposeTopic } from "../ai/proposeTopic.js";
import { notifyKakao } from "../kakao/index.js";
import { stripInlineMarkup } from "@app/shared";

// Generation is fire-and-forget from createAndGenerate's point of view (the
// dashboard just polls), but the scheduler needs to know when it actually
// finishes to send a meaningful "준비됐어요"/"실패했어요" notification —
// so it polls the post row itself rather than changing that shared
// contract. WebSearch-heavy 정보성 generation has taken up to ~3 minutes
// in testing; this ceiling leaves generous headroom.
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 20 * 60 * 1000;
const AVOID_LOOKBACK = 8;

async function waitForGenerationToSettle(postId: string): Promise<PostRecord | undefined> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const post = getPost(postId);
    if (!post || (post.status !== "generating" && post.status !== "queued")) return post;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return getPost(postId); // timed out — return whatever the last state was
}

/**
 * The entire scheduled-job body. Deliberately touches nothing but
 * posts/service.js, keyword-ideas, ai/proposeTopic, business-profile, and
 * kakao (all db + AI + pure assembly + best-effort notification) — see
 * .dependency-cruiser.cjs for the enforced rule that this module (and
 * everything under modules/scheduler) can never import modules/automation,
 * structurally ruling out auto-publish rather than just relying on
 * convention.
 */
export async function generateScheduledDraft(schedule: ScheduleRecord): Promise<void> {
  let request: PostRequest;
  let consumedIdeaId: string | undefined;

  if (schedule.topicSource === "queue") {
    // Queue-sourced schedules always produce 정보성 posts (keyword-driven,
    // AI writes its own title) — see shared/src/schedule.ts for why a fixed
    // 홍보성 title can't be auto-picked the same way.
    const idea = consumeNextKeywordIdea();
    let keyword: string;
    if (idea) {
      keyword = idea.text;
      consumedIdeaId = idea.id;
    } else {
      const profile = getBusinessProfile();
      const recent = getRecentPostsForDedup("informational", { limit: AVOID_LOOKBACK }).map((p) => p.title);
      keyword = await proposeTopic({ profile, avoidTopics: recent });
    }
    request = {
      postType: "informational",
      title: "",
      keyword,
      highlightContent: "",
      prewrittenContent: "",
      relatedPostTitle: "",
      relatedPostUrl: "",
    };
  } else {
    request = {
      postType: schedule.postType,
      title: schedule.title,
      keyword: schedule.keyword,
      highlightContent: schedule.highlightContent,
      prewrittenContent: "",
      relatedPostTitle: "",
      relatedPostUrl: "",
    };
  }

  const post = await createAndGenerate(request, { source: "scheduled", scheduleId: schedule.id });
  if (consumedIdeaId) linkKeywordIdeaToPost(consumedIdeaId, post.id);

  const settled = await waitForGenerationToSettle(post.id);
  await sendCompletionNotification(schedule, settled, request);
}

async function sendCompletionNotification(
  schedule: ScheduleRecord,
  post: PostRecord | undefined,
  request: PostRequest,
): Promise<void> {
  const topicLabel = request.postType === "informational" ? request.keyword : request.title;

  if (!post || post.status === "failed") {
    await notifyKakao(
      `[${schedule.name}] 글 자동 준비에 실패했어요 😥\n주제: ${topicLabel}\n대시보드에서 확인해주세요.`,
    );
    return;
  }
  if (post.status !== "review_pending" && post.status !== "ready") {
    // Timed out mid-generation — don't claim success or failure either way.
    await notifyKakao(
      `[${schedule.name}] 글 준비가 아직 진행 중이에요 (${post.status}). 잠시 후 대시보드에서 확인해주세요.\n주제: ${topicLabel}`,
    );
    return;
  }

  const preview = stripInlineMarkup(
    post.blocks.find((b) => b.type === "paragraph")?.text?.slice(0, 60) ?? "",
  );
  const warningLine = post.qaWarning ? `\n⚠️ 품질 점검 경고: ${post.qaWarning}` : "";
  await notifyKakao(
    `[${schedule.name}] 새 블로그 글이 준비됐어요! ✍️\n제목: ${post.title}\n${preview}${preview ? "..." : ""}${warningLine}\n대시보드에서 검토 후 발행해주세요.`,
  );
}
