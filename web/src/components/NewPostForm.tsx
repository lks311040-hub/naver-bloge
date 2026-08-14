import { useState, type ReactNode } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PostRequestSchema, type PostRequest } from "@app/shared";
import { fetchPost, generatePost } from "../api/posts";

const EMPTY: PostRequest = {
  postType: "promotional",
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

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    // No zodResolver — see Schedule.tsx for why (superRefine errors weren't
    // reaching formState with this project's zod v4 + resolver combo).
    // Validated by hand in the submit handler below instead.
    defaultValues: EMPTY,
  });
  const postType = watch("postType");
  const isInformational = postType === "informational";

  const generateMutation = useMutation({
    mutationFn: generatePost,
    onSuccess: (post) => {
      setActivePostId(post.id);
      reset({ ...EMPTY, postType });
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
        onSubmit={handleSubmit((data) => {
          clearErrors();
          const parsed = PostRequestSchema.safeParse(data);
          if (!parsed.success) {
            for (const issue of parsed.error.issues) {
              const field = issue.path[0];
              if (typeof field === "string") {
                setError(field as FieldPath<typeof data>, { type: "custom", message: issue.message });
              }
            }
            return;
          }
          generateMutation.mutate(parsed.data);
        })}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Field label="글 종류">
          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
              <input type="radio" value="promotional" {...register("postType")} />
              홍보성 글
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
              <input type="radio" value="informational" {...register("postType")} />
              정보성 글
            </label>
          </div>
        </Field>

        {isInformational && (
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
            홈피드 노출을 노리는 정보성 콘텐츠입니다. 제목은 AI가 주제 키워드로부터 직접 만들고, 실제 웹 검색으로
            관련 자료를 찾아 참고한 뒤 원장님만의 시선으로 다시 씁니다. 인사말/해시태그만 붙고 톡톡·예약 안내는
            붙지 않습니다.
          </p>
        )}

        {!isInformational && (
          <Field label="글 제목 (입력한 그대로 사용됩니다)">
            <input {...register("title")} />
            {errors.title && <span className="status-pill error">{errors.title.message}</span>}
          </Field>
        )}

        <Field label={isInformational ? "주제 키워드 (필수 — 이 주제로 제목과 본문을 만듭니다)" : "타겟 키워드 (선택 — 본문에 자연스럽게 4번 반복)"}>
          <input {...register("keyword")} placeholder={isInformational ? "예: 초등학생 영어 조기교육" : undefined} />
          {errors.keyword && <span className="status-pill error">{errors.keyword.message}</span>}
        </Field>

        <Field label={isInformational ? "이번 글에서 다루고 싶은 관점/포인트 (선택, 사실만)" : "이번 글에서 강조할 내용 (선택, 사실만)"}>
          <textarea rows={3} {...register("highlightContent")} />
        </Field>

        <Field label="직접 써 놓은 내용 (선택 — AI가 다듬지 않고 그대로 본문 뒤에 삽입, 한 줄 = 한 문단)">
          <textarea rows={5} {...register("prewrittenContent")} />
        </Field>

        {!isInformational && (
          <>
            <Field label="함께 읽으면 좋은 글 제목 (선택 — 비워두면 최근 발행글로 자동 연결)">
              <input {...register("relatedPostTitle")} />
            </Field>
            <Field label="함께 읽으면 좋은 글 링크">
              <input {...register("relatedPostUrl")} />
            </Field>
          </>
        )}

        {Object.keys(errors).length > 0 && (
          <p style={{ color: "#b91c1c", fontSize: 13, margin: 0 }}>
            입력을 확인해주세요:{" "}
            {Object.values(errors)
              .map((e) => e?.message)
              .filter(Boolean)
              .join(" / ")}
          </p>
        )}

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
          <p style={{ margin: 0, fontWeight: 600 }}>{post.title || "(제목 생성 중...)"}</p>
          {inProgress && (
            <p style={{ color: "#6b7280" }}>
              <span className="status-pill">
                AI가 초안을 작성하는 중입니다... (웹 검색을 포함해 보통 5~10분 정도 걸립니다)
              </span>
            </p>
          )}
          {post.status === "review_pending" && (
            <div>
              <p>
                <span className="status-pill ok">초안 생성 완료</span> 글자수 {post.charCount}자
                {post.postType === "promotional" && <> · 키워드 등장 {post.keywordCount}회</>}
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
