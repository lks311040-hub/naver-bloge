import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectKakao,
  fetchKakaoConfig,
  fetchKakaoStatus,
  saveKakaoConfig,
  sendKakaoTest,
} from "../api/kakao";

export default function KakaoNotifyPanel() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["kakao-status"], queryFn: fetchKakaoStatus });
  const configQuery = useQuery({ queryKey: ["kakao-config"], queryFn: fetchKakaoConfig });

  const [restApiKey, setRestApiKey] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["kakao-status"] });
    queryClient.invalidateQueries({ queryKey: ["kakao-config"] });
  };

  const saveConfigMutation = useMutation({
    mutationFn: () => saveKakaoConfig({ restApiKey, clientSecret }),
    onSuccess: invalidate,
  });

  const disconnectMutation = useMutation({ mutationFn: disconnectKakao, onSuccess: invalidate });

  const testMutation = useMutation({
    mutationFn: sendKakaoTest,
    onSuccess: (res) => setTestResult(res.ok ? "테스트 메시지를 보냈습니다. 카카오톡을 확인해보세요." : `실패: ${res.error}`),
    onError: (err) => setTestResult(`실패: ${String(err)}`),
  });

  const configuredKey = configQuery.data?.restApiKey ?? "";
  const connected = statusQuery.data?.connected ?? false;

  return (
    <section>
      <h3>카카오톡 알림</h3>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        예약된 글이 준비되면(또는 실패하면) 사장님 카카오톡으로 "나에게 보내기" 알림을 보냅니다. 먼저{" "}
        <a href="https://developers.kakao.com" target="_blank" rel="noreferrer">
          카카오 개발자 사이트
        </a>
        에서 앱을 만들고, "카카오 로그인" 활성화 + Redirect URI에{" "}
        <code>http://localhost:4000/api/kakao/callback</code>를 등록한 뒤, "카카오톡 메시지" 동의항목을 켜주세요.
        그 앱의 REST API 키를 아래에 입력하면 됩니다 (Client Secret은 앱에서 사용 설정을 켠 경우만 입력).
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480, marginBottom: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>REST API 키</span>
          <input
            value={restApiKey || configuredKey}
            onChange={(e) => setRestApiKey(e.target.value)}
            placeholder={configuredKey ? "(설정됨 — 바꾸려면 새로 입력)" : "카카오 개발자 콘솔의 REST API 키"}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Client Secret (선택)</span>
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            type="password"
            placeholder={configQuery.data?.hasClientSecret ? "(설정됨 — 바꾸려면 새로 입력)" : "사용 설정을 켠 경우만"}
          />
        </label>
        <div>
          <button
            type="button"
            onClick={() => saveConfigMutation.mutate()}
            disabled={saveConfigMutation.isPending || !(restApiKey || configuredKey)}
          >
            {saveConfigMutation.isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <p>
        {connected ? (
          <span className="status-pill ok">연결됨</span>
        ) : statusQuery.data?.configured ? (
          <span className="status-pill">키 등록됨 (연결 안 됨)</span>
        ) : (
          <span className="status-pill">설정 필요</span>
        )}
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {!connected && (
          <a href="/api/kakao/login" target="_blank" rel="noreferrer">
            <button type="button" disabled={!statusQuery.data?.configured}>
              카카오 연결하기 (새 창에서 직접 로그인)
            </button>
          </a>
        )}
        {connected && (
          <>
            <button type="button" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
              {testMutation.isPending ? "발송 중..." : "테스트 메시지 보내기"}
            </button>
            <button type="button" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
              연결 해제
            </button>
          </>
        )}
      </div>
      {testResult && <p style={{ fontSize: 13, color: "#374151", marginTop: 8 }}>{testResult}</p>}
    </section>
  );
}
