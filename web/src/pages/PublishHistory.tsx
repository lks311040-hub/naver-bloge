import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "../api/posts";

export default function PublishHistory() {
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["posts", "published"],
    queryFn: () => fetchPosts("published"),
  });

  const filtered = (query.data ?? []).filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h2>발행 이력</h2>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        직접 발행한 뒤 "발행완료로 표시"를 누른 글이 여기에 쌓입니다. 새 글 작성 시 "함께 읽으면 좋은 글"을 비워두면
        가장 최근에 여기 쌓인 글로 자동 연결됩니다.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="제목으로 검색"
        style={{ marginBottom: 16, width: "100%", maxWidth: 320 }}
      />

      {query.isLoading && <p style={{ color: "#6b7280" }}>불러오는 중...</p>}
      {query.isError && <p className="status-pill error">불러오지 못했습니다: {String(query.error)}</p>}
      {query.data && filtered.length === 0 && (
        <p style={{ color: "#6b7280" }}>
          {query.data.length === 0 ? "아직 발행된 글이 없습니다." : "검색 결과가 없습니다."}
        </p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>
            <th style={{ padding: "8px 4px" }}>제목</th>
            <th style={{ padding: "8px 4px" }}>키워드</th>
            <th style={{ padding: "8px 4px" }}>글자수</th>
            <th style={{ padding: "8px 4px" }}>발행일</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((post) => (
            <tr key={post.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "10px 4px" }}>
                <a href={post.publishedUrl ?? "#"} target="_blank" rel="noreferrer">
                  {post.title}
                </a>
              </td>
              <td style={{ padding: "10px 4px", color: "#6b7280" }}>{post.keyword || "-"}</td>
              <td style={{ padding: "10px 4px", color: "#6b7280" }}>{post.charCount ? `${post.charCount}자` : "-"}</td>
              <td style={{ padding: "10px 4px", color: "#6b7280" }}>
                {post.publishedAt ? new Date(post.publishedAt).toLocaleString("ko-KR") : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
