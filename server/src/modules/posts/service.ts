import type { BusinessProfileRecord, PostRecord, PostRequest, PostSource } from "@app/shared";
import { getBusinessProfile } from "../business-profile/repo.js";
import { generateDraft } from "../ai/index.js";
import { assemblePost } from "./assemble.js";
import { completeGeneration, createPost, getLatestPublished, markPostFailed } from "./repo.js";

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
 * takes several minutes (multiple Claude calls for the self-check/retry
 * loop), far too long to hold an HTTP request open.
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

async function runGeneration(
  postId: string,
  request: PostRequest,
  profile: BusinessProfileRecord,
): Promise<void> {
  try {
    const aiResult = await generateDraft({
      title: request.title,
      keyword: request.keyword,
      highlightContent: request.highlightContent,
      profile,
    });

    let relatedPostTitle = request.relatedPostTitle;
    let relatedPostUrl = request.relatedPostUrl;
    if (!relatedPostTitle.trim() && !relatedPostUrl.trim()) {
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
    );

    completeGeneration(postId, {
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
