import type { Block, BusinessProfileRecord, PostRecord, PostRequest, PostSource } from "@app/shared";
import { stripInlineMarkup } from "@app/shared";
import { getBusinessProfile } from "../business-profile/repo.js";
import { generateDraft } from "../ai/index.js";
import { assemblePost } from "./assemble.js";
import {
  completeGeneration,
  createPost,
  getLatestPublished,
  getPost,
  getRecentPostsForDedup,
  markPostFailed,
  markPostGenerating,
} from "./repo.js";

export interface CreateAndGenerateOptions {
  source: PostSource;
  /** Set when triggered by the scheduler — links the resulting post back to it. */
  scheduleId?: string;
}

/**
 * Creates the post row immediately (status: generating) and kicks off AI
 * generation in the background — the caller gets the row back right away
 * and the frontend polls GET /api/posts/:id for status (or, for a
 * scheduler-triggered run, nothing polls it — it just lands as
 * review_pending for a human to find later in 초안). Generation regularly
 * takes several minutes (multiple Claude calls, now possibly including
 * WebSearch round-trips), far too long to hold an HTTP request open.
 *
 * This function — and its whole import graph — never references
 * modules/automation. That's what lets the scheduler call it directly and
 * still be structurally incapable of publishing anything (see
 * modules/scheduler and .dependency-cruiser.cjs).
 */
export async function createAndGenerate(
  request: PostRequest,
  opts: CreateAndGenerateOptions = { source: "manual" },
): Promise<PostRecord> {
  const profile = getBusinessProfile();
  const post = createPost(request, { status: "generating", source: opts.source, scheduleId: opts.scheduleId });

  void runGeneration(post.id, request, profile);

  return post;
}

export interface RegenerateResult {
  ok: boolean;
  error?: string;
}

/**
 * Retries generation for an existing post — reuses its already-stored
 * request fields (postType/title/keyword/highlightContent/prewrittenContent/
 * relatedPost*), so the "다시 생성하기" button needs no new input. Used for
 * posts stuck in `failed` where generation itself never produced blocks
 * (as opposed to an autofill failure, which retries via the existing
 * /autofill endpoint instead — that one doesn't need regeneration at all).
 */
export async function regeneratePost(postId: string): Promise<RegenerateResult> {
  const post = getPost(postId);
  if (!post) return { ok: false, error: "post_not_found" };

  const profile = getBusinessProfile();
  markPostGenerating(postId);
  void runGeneration(
    postId,
    {
      postType: post.postType,
      title: post.title,
      keyword: post.keyword,
      highlightContent: post.highlightContent,
      prewrittenContent: post.prewrittenContent,
      relatedPostTitle: post.relatedPostTitle,
      relatedPostUrl: post.relatedPostUrl,
    },
    profile,
  );
  return { ok: true };
}

const DEDUP_LOOKBACK = 5;
const DEDUP_SNIPPET_CHARS = 300;

/** Plain-text preview of a post's AI body (paragraph/heading text only,
 * markup stripped) for "don't repeat this angle" prompt context. */
function summarizeForDedup(blocks: Block[]): string {
  const text = blocks
    .filter((b) => b.type === "paragraph" || b.type === "heading")
    .map((b) => stripInlineMarkup((b as { text: string }).text))
    .join(" ");
  return text.length > DEDUP_SNIPPET_CHARS ? `${text.slice(0, DEDUP_SNIPPET_CHARS)}...` : text;
}

async function runGeneration(
  postId: string,
  request: PostRequest,
  profile: BusinessProfileRecord,
): Promise<void> {
  try {
    const avoidOverlapWith = getRecentPostsForDedup(request.postType, { excludeId: postId, limit: DEDUP_LOOKBACK }).map(
      (p) => ({ title: p.title, snippet: summarizeForDedup(p.blocks) }),
    );

    const aiResult = await generateDraft({
      postType: request.postType,
      title: request.title,
      keyword: request.keyword,
      highlightContent: request.highlightContent,
      profile,
      avoidOverlapWith,
    });

    // 관련 글 자동 연결은 홍보성에만 적용 — 정보성은 애초에 assemble.ts가
    // related_post 블록을 만들지 않으므로 여기서 채워봐야 쓰이지 않는다.
    let relatedPostTitle = request.relatedPostTitle;
    let relatedPostUrl = request.relatedPostUrl;
    if (request.postType === "promotional" && !relatedPostTitle.trim() && !relatedPostUrl.trim()) {
      const latest = getLatestPublished();
      if (latest) {
        relatedPostTitle = latest.title;
        relatedPostUrl = latest.url;
      }
    }

    const blocks = assemblePost(
      profile,
      { prewrittenContent: request.prewrittenContent, relatedPostTitle, relatedPostUrl },
      aiResult.blocks,
      request.postType,
    );

    completeGeneration(postId, {
      title: aiResult.title,
      blocks,
      charCount: aiResult.charCount,
      keywordCount: aiResult.keywordCount,
      qaWarning: aiResult.qaWarning,
      relatedPostTitle,
      relatedPostUrl,
    });
  } catch (err) {
    markPostFailed(postId, err instanceof Error ? err.message : String(err));
  }
}
