import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createKeywordIdea, deleteKeywordIdea, fetchKeywordIdeas } from "../api/keywordIdeas";

export default function KeywordIdeas() {
  const queryClient = useQueryClient();
  const ideasQuery = useQuery({ queryKey: ["keyword-ideas"], queryFn: fetchKeywordIdeas });
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
  const unused = ideas.filter((i) => !i.usedAt);
  const used = ideas.filter((i) => i.usedAt);

  return (
    <div>
      <h2>글감 메모장</h2>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        생각날 때마다 글감(주제)을 적어두세요. "예약" 화면에서 <strong>글감 큐 사용</strong>으로 설정된 예약이
        실행될 때마다, 오래된 순서대로 여기서 하나씩 자동으로 꺼내 정보성 글의 주제로 씁니다. 큐가 비어 있으면
        AI가 알아서 새로운 주제를 골라 씁니다. 새 글 작성 화면의 "주제 키워드" 칸에 직접 붙여넣어 수동으로 써도
        됩니다.
      </p>

      <section>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            createMutation.mutate({ text: text.trim(), memo: memo.trim() });
          }}
          style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>글감</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 손 작은 아이 피아노" />
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

      <section>
        <h3>대기 중 ({unused.length})</h3>
        {ideasQuery.isLoading && <p style={{ color: "#6b7280" }}>불러오는 중...</p>}
        {unused.length === 0 && !ideasQuery.isLoading && (
          <p style={{ color: "#6b7280" }}>대기 중인 글감이 없습니다. 큐 사용 예약이 실행되면 AI가 알아서 주제를 고릅니다.</p>
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
              <button type="button" onClick={() => deleteMutation.mutate(idea.id)}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      </section>

      {used.length > 0 && (
        <section>
          <h3>이미 사용됨 ({used.length})</h3>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {used.map((idea) => (
              <li key={idea.id} style={{ padding: "6px 10px", color: "#9ca3af", fontSize: 13 }}>
                {idea.text} — {idea.usedAt ? new Date(idea.usedAt).toLocaleDateString("ko-KR") : ""}에 사용됨
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
