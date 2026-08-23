import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { detectPublishedPosts, fetchPosts } from "../api/posts";

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

export default function Drafts() {
  const queryClient = useQueryClient();
  const postsQuery = useQuery({
    queryKey: ["posts"],
    queryFn: () => fetchPosts(),
    refetchInterval: 5000,
  });

  const detectMutation = useMutation({
    mutationFn: detectPublishedPosts,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const waitingCount = postsQuery.data?.filter((p) => p.status === "filled_awaiting_publish").length ?? 0;
  const result = detectMutation.data;

  return (
    <div>
      <h2>초안</h2>

      {waitingCount > 0 && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 20, maxWidth: 620 }}>
          <p style={{ margin: "0 0 8px", fontSize: 14 }}>
            <strong>발행 대기 {waitingCount}건</strong> — 에디터에서 <strong>예약 발행</strong>을 걸어두셨다면, 그
            시점엔 글 주소가 없어서 기록할 수 없습니다. 실제로 올라간 뒤 아래 버튼을 누르면 블로그에서 찾아 주소를
            자동으로 기록합니다.
          </p>
          <button type="button" onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending}>
            {detectMutation.isPending ? "블로그 확인 중..." : "블로그에서 발행된 글 찾기"}
          </button>

          {detectMutation.isError && (
            <p className="status-pill error" style={{ display: "block", marginTop: 12 }}>
              {String(detectMutation.error)}
            </p>
          )}

          {result && (
            <div style={{ marginTop: 12, fontSize: 14 }}>
              {result.matched.length === 0 ? (
                <p style={{ margin: 0, color: "#6b7280" }}>
                  블로그 글 {result.feedCount}개를 확인했지만, 발행 대기 중인 글과 같은 제목은 없었습니다 — 아직
                  발행 전이거나 제목을 많이 바꾸신 것 같습니다.
                </p>
              ) : (
                <>
                  <p style={{ margin: "0 0 6px", fontWeight: 600 }}>{result.matched.length}건을 발행 완료로 기록했습니다</p>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#6b7280" }}>
                    {result.matched.map((m) => (
                      <li key={m.postId}>
                        {m.title.slice(0, 30)}
                        {m.how === "prefix" && " (제목 앞부분만 일치 — 주소를 한번 확인해주세요)"}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {result.unmatchedTitles.length > 0 && (
                <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
                  못 찾은 글 {result.unmatchedTitles.length}건은 그대로 발행 대기에 남아 있습니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {postsQuery.isLoading && <p style={{ color: "#6b7280" }}>불러오는 중...</p>}
      {postsQuery.isError && (
        <p className="status-pill error">목록을 불러오지 못했습니다: {String(postsQuery.error)}</p>
      )}
      {postsQuery.data && postsQuery.data.length === 0 && (
        <p style={{ color: "#6b7280" }}>아직 작성된 글이 없습니다. 글 작성 화면에서 새 글을 만들어보세요.</p>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          {postsQuery.data?.map((post) => (
            <tr key={post.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "10px 4px" }}>
                <span className="status-pill" style={{ marginRight: 8 }}>
                  {POST_TYPE_LABEL[post.postType] ?? post.postType}
                </span>
                <Link to={`/drafts/${post.id}`}>{post.title || "(제목 생성 중...)"}</Link>
              </td>
              <td style={{ padding: "10px 4px", color: "#6b7280" }}>
                {STATUS_LABEL[post.status] ?? post.status}
              </td>
              <td style={{ padding: "10px 4px", color: "#6b7280" }}>
                {post.charCount ? `${post.charCount}자` : "-"}
              </td>
              <td style={{ padding: "10px 4px", color: "#6b7280" }}>
                {new Date(post.createdAt).toLocaleString("ko-KR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
