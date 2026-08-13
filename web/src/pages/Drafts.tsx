import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchPosts } from "../api/posts";

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
  const postsQuery = useQuery({
    queryKey: ["posts"],
    queryFn: () => fetchPosts(),
    refetchInterval: 5000,
  });

  return (
    <div>
      <h2>초안</h2>
      {postsQuery.isLoading && <p style={{ color: "#6b7280" }}>불러오는 중...</p>}
      {postsQuery.isError && (
        <p className="status-pill error">목록을 불러오지 못했습니다: {String(postsQuery.error)}</p>
      )}
      {postsQuery.data && postsQuery.data.length === 0 && (
        <p style={{ color: "#6b7280" }}>아직 작성된 글이 없습니다. 홍보글 작성 화면에서 새 글을 만들어보세요.</p>
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
