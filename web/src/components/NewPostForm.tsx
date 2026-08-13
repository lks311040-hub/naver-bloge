import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PostRequestSchema, type PostRequest } from "@app/shared";
import { fetchPost, generatePost } from "../api/posts";

const EMPTY: PostRequest = {
  title: "",
  keyword: "",
  highlightContent: "",
  prewrittenContent: "",
  relatedPostTitle: "",
  relatedPostUrl: "",
};

const IN_PROGRESS_STATUSES = new Set(["queued", "generating"]);

export default function NewPostForm() {
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm<PostRequest>({
    resolver: zodResolver(PostRequestSchema),
    defaultValues: EMPTY,
  });

  const generateMutation = useMutation({
    mutationFn: generatePost,
    onSuccess: (post) => {
      setActivePostId(post.id);
      reset(EMPTY);
    },
  });

  const postQuery = useQuery({
    queryKey: ["post", activePostId],
    queryFn: () => fetchPost(activePostId!),
    enabled: !!activePostId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && IN_PROGRESS_STATUSES.has(status) ? 4000 : false;
    },
  });

  const post = postQuery.data;
  const inProgress = post ? IN_PROGRESS_STATUSES.has(post.status) : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <form
        onSubmit={handleSubmit((data) => generateMutation.mutate(data))}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Field label="글 제목 (입력한 그대로 사용됩니다)">
          <input {...register("title")} required />
        </Field>
        <Field label="타겟 키워드 (선택 — 본문에 자연스럽게 4번 반복)">
          <input {...register("keyword")} />
        </Field>
        <Field label="이번 글에서 강조할 내용 (선택, 사실만)">
          <textarea rows={3} {...register("highlightContent")} />
        </Field>
        <Field label="직접 써 놓은 내용 (선택 — AI가 다듬지 않고 그대로 본문 뒤에 삽입, 한 줄 = 한 문단)">
          <textarea rows={5} {...register("prewrittenContent")} />
        </Field>
        <Field label="함께 읽으면 좋은 글 제목 (선택 — 비워두면 최근 발행글로 자동 연결)">
          <input {...register("relatedPostTitle")} />
        </Field>
        <Field label="함께 읽으면 좋은 글 링크">
          <input {...register("relatedPostUrl")} />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" disabled={generateMutation.isPending || inProgress}>
            {generateMutation.isPending ? "요청 중..." : "AI 초안 생성"}
          </button>
          {generateMutation.isError && (
            <span className="status-pill error">요청 실패: {String(generateMutation.error)}</span>
          )}
        </div>
      </form>

      {post && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{post.title}</p>
          {inProgress && (
            <p style={{ color: "#6b7280" }}>
              <span className="status-pill">AI가 초안을 작성하는 중입니다... (보통 3~5분 정도 걸립니다)</span>
            </p>
          )}
          {post.status === "review_pending" && (
            <div>
              <p>
                <span className="status-pill ok">초안 생성 완료</span>{" "}
                글자수 {post.charCount}자 · 키워드 등장 {post.keywordCount}회
              </p>
              {post.qaWarning && (
                <p className="status-pill error" style={{ display: "block", whiteSpace: "pre-wrap" }}>
                  ⚠ {post.qaWarning}
                </p>
              )}
              <Link to={`/drafts/${post.id}`}>초안 검토하러 가기 →</Link>
            </div>
          )}
          {post.status === "failed" && (
            <p className="status-pill error" style={{ display: "block", whiteSpace: "pre-wrap" }}>
              생성 실패: {post.qaWarning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}
