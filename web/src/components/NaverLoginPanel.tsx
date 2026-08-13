import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNaverStatus, startNaverLogin } from "../api/naver";
import { useEventSource } from "../hooks/useEventSource";

export default function NaverLoginPanel() {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const logs = useEventSource(runId);

  const statusQuery = useQuery({ queryKey: ["naver-status"], queryFn: fetchNaverStatus });

  const loginMutation = useMutation({
    mutationFn: startNaverLogin,
    onSuccess: ({ runId }) => setRunId(runId),
  });

  const lastLog = logs[logs.length - 1];
  const finished = lastLog?.level === "done" || lastLog?.level === "warn" || lastLog?.level === "error";
  const inProgress = runId !== null && !finished;

  useEffect(() => {
    if (lastLog?.level === "done") {
      queryClient.invalidateQueries({ queryKey: ["naver-status"] });
    }
  }, [lastLog, queryClient]);

  return (
    <section>
      <h3>네이버 로그인</h3>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        로그인 버튼을 누르면 실제로 보이는 브라우저 창이 새로 뜹니다 — 아이디·비밀번호는 그 창에서 직접 입력해주세요
        (이 프로그램은 절대 대신 입력하지 않습니다). 한 번 로그인해두면 세션이 저장되어 다음부터는 다시 로그인할
        필요가 없습니다.
      </p>

      {statusQuery.data?.blogId ? (
        <p>
          <span className="status-pill ok">로그인됨</span>{" "}
          <span style={{ color: "#374151" }}>blogId: {statusQuery.data.blogId}</span>
        </p>
      ) : (
        <p>
          <span className="status-pill">로그인 안 됨</span>
        </p>
      )}

      <button type="button" onClick={() => loginMutation.mutate()} disabled={loginMutation.isPending || inProgress}>
        {inProgress ? "로그인 진행 중..." : "네이버 로그인"}
      </button>
      {loginMutation.isError && (
        <span className="status-pill error" style={{ marginLeft: 12 }}>
          {String(loginMutation.error)}
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
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {logs.map((l, i) => (
            <div key={i} style={{ color: l.level === "error" ? "#fca5a5" : l.level === "warn" ? "#fde68a" : undefined }}>
              [{l.level}] {l.message}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
