import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostRecord } from "@app/shared";
import { approvePost, autofillPost, fetchPost, markPostPublished, regeneratePost } from "../api/posts";
import BlockRenderer from "../components/blocks/BlockRenderer";
import { useEventSource } from "../hooks/useEventSource";

const IN_PROGRESS_STATUSES = new Set(["queued", "generating", "filling"]);

const STATUS_LABEL: Record<string, string> = {
  queued: "대기",
  generating: "생성 중",
  review_pending: "검토 대기",
  ready: "승인됨",
  filling: "자동입력 중",
  filled_awaiting_publish: "발행 대기",
  published: "발행 완료",
  failed: "실패",
};

const POST_TYPE_LABEL: Record<string, string> = {
  promotional: "홍보성",
  informational: "정보성",
};

export default function DraftReview() {
  const { postId } = useParams<{ postId: string }>();
  const queryClient = useQueryClient();
  const [autofillRunId, setAutofillRunId] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState("");
  const logs = useEventSource(autofillRunId);

  const postQuery = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPost(postId!),
    enabled: !!postId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && IN_PROGRESS_STATUSES.has(status) ? 4000 : false;
    },
  });

  function setPostCache(post: PostRecord) {
    queryClient.setQueryData(["post", postId], post);
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  }

  const approveMutation = useMutation({
    mutationFn: () => approvePost(postId!),
    onSuccess: setPostCache,
  });

  const autofillMutation = useMutation({
    mutationFn: () => autofillPost(postId!),
    onSuccess: ({ runId }) => setAutofillRunId(runId),
  });

  const markPublishedMutation = useMutation({
    mutationFn: () => markPostPublished(postId!, publishedUrl),
    onSuccess: setPostCache,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regeneratePost(postId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["post", postId] }),
  });

  const lastLog = logs[logs.length - 1];
  useEffect(() => {
    if (lastLog?.level === "done" || lastLog?.level === "error") {
      // The autofill run's final status write already landed server-side —
      // refetch so the button/section below reflects it immediately.
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    }
  }, [lastLog, postId, queryClient]);

  if (postQuery.isLoading) return <p style={{ color: "#6b7280" }}>불러오는 중...</p>;
  if (postQuery.isError) {
    return <p className="status-pill error">불러오지 못했습니다: {String(postQuery.error)}</p>;
  }
  const post = postQuery.data!;
  const autofillInProgress = post.status === "filling";
  const failedAtGeneration = post.status === "failed" && post.blocks.length === 0;
  const failedAtAutofill = post.status === "failed" && post.blocks.length > 0;
  // 자동입력을 이미 한 번 한 글. 그날 열린 에디터 창을 닫아버렸거나 발행을
  // 미뤄뒀으면 다시 열 방법이 없어서 글이 그대로 묶여 있었다 — 밀린 글을
  // 하나씩 처리하려면 여기서 다시 열 수 있어야 한다.
  const alreadyFilled = post.status === "filled_awaiting_publish";

  return (
    <div>
      <h2>초안 검토</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span className="status-pill">{POST_TYPE_LABEL[post.postType] ?? post.postType}</span>
        <span className="status-pill">{STATUS_LABEL[post.status] ?? post.status}</span>
        {post.charCount != null && <span style={{ color: "#6b7280", fontSize: 13 }}>{post.charCount}자</span>}
        {post.postType === "promotional" && post.keywordCount != null && (
          <span style={{ color: "#6b7280", fontSize: 13 }}>키워드 {post.keywordCount}회</span>
        )}
      </div>

      {post.qaWarning && (
        <p className="status-pill error" style={{ display: "block", whiteSpace: "pre-wrap", marginBottom: 16 }}>
          ⚠ {post.qaWarning}
        </p>
      )}

      {failedAtGeneration && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            AI 초안 생성이 실패했습니다. 입력했던 제목/키워드/강조 내용 그대로 다시 시도할 수 있습니다.
          </p>
          <button type="button" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
            {regenerateMutation.isPending ? "다시 생성 요청 중..." : "다시 생성하기"}
          </button>
          {regenerateMutation.isError && (
            <span className="status-pill error" style={{ marginLeft: 12 }}>
              {String(regenerateMutation.error)}
            </span>
          )}
        </div>
      )}

      <h1 style={{ fontSize: 22 }}>{post.title}</h1>

      <div style={{ maxWidth: 720 }}>
        {post.blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} postId={post.id} onUpdated={setPostCache} />
        ))}
      </div>

      {post.status === "review_pending" && (
        <div style={{ marginTop: 24 }}>
          <button type="button" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
            {approveMutation.isPending ? "승인 중..." : "이 초안 승인"}
          </button>
          {approveMutation.isError && (
            <span className="status-pill error" style={{ marginLeft: 12 }}>
              {String(approveMutation.error)}
            </span>
          )}
        </div>
      )}

      {(post.status === "ready" || autofillInProgress || failedAtAutofill || alreadyFilled) && (
        <div style={{ marginTop: 24 }}>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            네이버 블로그 글쓰기 화면을 열어 제목·본문·서식·사진/영상을 자동으로 채워 넣습니다. 발행 버튼은
            누르지 않으니, 채워진 내용을 확인하고 <strong>직접 발행</strong>해주세요.
            {failedAtAutofill && " 지난 시도가 중간에 실패했습니다 — 다시 시도하면 처음부터 새로 채워 넣습니다."}
            {alreadyFilled &&
              " 이 글은 전에 한 번 에디터에 넣었던 글입니다 — 다시 열면 빈 글쓰기 화면에 처음부터 새로 채워 넣습니다 (네이버에 남아있는 임시저장을 이어쓰지 않습니다)."}
          </p>
          <button
            type="button"
            onClick={() => autofillMutation.mutate()}
            disabled={autofillMutation.isPending || autofillInProgress}
          >
            {autofillInProgress
              ? "자동입력 진행 중..."
              : failedAtAutofill
                ? "자동입력 다시 시도"
                : alreadyFilled
                  ? "네이버 에디터에 다시 열기"
                  : "네이버 에디터에 자동입력"}
          </button>
          {autofillMutation.isError && (
            <span className="status-pill error" style={{ marginLeft: 12 }}>
              {String(autofillMutation.error)}
            </span>
          )}

          {logs.length > 0 && (
            <div
              style={{
                marginTop: 12,
                background: "#111827",
                color: "#e5e7eb",
                padding: 12,
                borderRadius: 8,
                fontFamily: "monospace",
                fontSize: 12,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {logs.map((l, i) => (
                <div
                  key={i}
                  style={{ color: l.level === "error" ? "#fca5a5" : l.level === "warn" ? "#fde68a" : undefined }}
                >
                  [{l.level}] {l.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(post.status === "filled_awaiting_publish" || post.status === "published") && (
        <div style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>발행 완료로 표시</h3>
          {post.status === "published" ? (
            <p>
              <span className="status-pill ok">발행됨</span>{" "}
              <a href={post.publishedUrl ?? "#"} target="_blank" rel="noreferrer">
                {post.publishedUrl}
              </a>
            </p>
          ) : (
            <>
              <p style={{ color: "#6b7280", fontSize: 14 }}>
                열려있는 창에서 직접 발행 버튼을 누른 뒤, 실제 발행된 글 주소를 붙여넣어 기록해주세요.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={publishedUrl}
                  onChange={(e) => setPublishedUrl(e.target.value)}
                  placeholder="https://blog.naver.com/..."
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => markPublishedMutation.mutate()}
                  disabled={markPublishedMutation.isPending || !publishedUrl.trim()}
                >
                  {markPublishedMutation.isPending ? "저장 중..." : "발행완료로 표시"}
                </button>
              </div>
              {markPublishedMutation.isError && (
                <p className="status-pill error" style={{ marginTop: 8 }}>
                  {String(markPublishedMutation.error)}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
