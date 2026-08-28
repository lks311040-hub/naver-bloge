import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { KeywordIdeaRecord, PostType } from "@app/shared";
import { createKeywordIdea, deleteKeywordIdea, fetchKeywordIdeas } from "../api/keywordIdeas";

const POST_TYPE_LABEL: Record<PostType, string> = { promotional: "홍보성", informational: "정보성" };

export default function KeywordIdeas() {
  const queryClient = useQueryClient();
  const ideasQuery = useQuery({ queryKey: ["keyword-ideas"], queryFn: fetchKeywordIdeas });
  const [postType, setPostType] = useState<PostType>("informational");
  const [text, setText] = useState("");
  const [memo, setMemo] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["keyword-ideas"] });

  const createMutation = useMutation({
    mutationFn: createKeywordIdea,
    onSuccess: () => {
      invalidate();
      setText("");
      setMemo("");
    },
  });
  const deleteMutation = useMutation({ mutationFn: deleteKeywordIdea, onSuccess: invalidate });

  const ideas = ideasQuery.data ?? [];

  return (
    <div>
      <h2>글감 메모장</h2>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        생각날 때마다 글감을 <strong>홍보성/정보성으로 나눠서</strong> 적어두세요. "예약" 화면에서 그 종류의
        글감 큐를 쓰도록 설정한 예약이 실행될 때마다, 같은 종류 안에서 오래된 순서대로 하나씩 자동으로 꺼내
        씁니다. 정보성 글감은 AI가 그 주제로 제목을 새로 짓고, 홍보성 글감은 <strong>그대로 글 제목</strong>
        으로 쓰입니다. 큐가 비어 있으면 AI가 알아서 새 주제/제목을 고릅니다.
      </p>

      <section>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            createMutation.mutate({ postType, text: text.trim(), memo: memo.trim() });
          }}
          style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>글 종류</span>
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                <input
                  type="radio"
                  checked={postType === "informational"}
                  onChange={() => setPostType("informational")}
                />
                정보성 (AI가 제목을 새로 지음)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                <input
                  type="radio"
                  checked={postType === "promotional"}
                  onChange={() => setPostType("promotional")}
                />
                홍보성 (그대로 글 제목으로 사용)
              </label>
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {postType === "informational" ? "글감 (주제)" : "글감 (제목 그대로)"}
            </span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={postType === "informational" ? "예: 손 작은 아이 피아노" : "예: 신학기 유치부 모집 안내"}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>메모 (선택)</span>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="어디서 떠올렸는지 등" />
          </label>
          <div>
            <button type="submit" disabled={createMutation.isPending || !text.trim()}>
              {createMutation.isPending ? "추가 중..." : "글감 추가"}
            </button>
          </div>
        </form>
      </section>

      {ideasQuery.isLoading && <p style={{ color: "#6b7280" }}>불러오는 중...</p>}

      <IdeaGroup title="정보성 글감" postType="informational" ideas={ideas} onDelete={(id) => deleteMutation.mutate(id)} />
      <IdeaGroup title="홍보성 글감" postType="promotional" ideas={ideas} onDelete={(id) => deleteMutation.mutate(id)} />
    </div>
  );
}

function IdeaGroup({
  title,
  postType,
  ideas,
  onDelete,
}: {
  title: string;
  postType: PostType;
  ideas: KeywordIdeaRecord[];
  onDelete: (id: string) => void;
}) {
  const scoped = ideas.filter((i) => i.postType === postType);
  const unused = scoped.filter((i) => !i.usedAt);
  const used = scoped.filter((i) => i.usedAt);

  return (
    <section>
      <h3>
        {title} — 대기 중 ({unused.length})
      </h3>
      {unused.length === 0 && (
        <p style={{ color: "#6b7280" }}>
          대기 중인 {POST_TYPE_LABEL[postType]} 글감이 없습니다. 이 종류의 큐 사용 예약이 실행되면 AI가 알아서
          고릅니다.
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {unused.map((idea) => (
          <li
            key={idea.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
            }}
          >
            <div>
              <strong>{idea.text}</strong>
              {idea.memo && <div style={{ color: "#6b7280", fontSize: 12 }}>{idea.memo}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {/* 글감을 손으로 옮겨 적지 않아도 되게 글 작성 화면으로 값을 넘긴다.
                  글 종류/본문은 쿼리로 전달하고, ideaId는 초안이 만들어진 뒤
                  이 글감을 사용됨으로 표시하는 데 쓴다. */}
              <Link
                to={`/?ideaId=${encodeURIComponent(idea.id)}&postType=${idea.postType}&text=${encodeURIComponent(idea.text)}`}
              >
                <button type="button">이 글감으로 쓰기</button>
              </Link>
              <button type="button" onClick={() => onDelete(idea.id)}>
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>

      {used.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ color: "#9ca3af", fontSize: 13, cursor: "pointer" }}>이미 사용됨 ({used.length})</summary>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {used.map((idea) => (
              <li key={idea.id} style={{ padding: "6px 10px", color: "#9ca3af", fontSize: 13 }}>
                {idea.text} — {idea.usedAt ? new Date(idea.usedAt).toLocaleDateString("ko-KR") : ""}에 사용됨
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
