import { useEffect, useState } from "react";
import BusinessProfileForm from "../components/BusinessProfileForm";
import NewPostForm from "../components/NewPostForm";
import NaverLoginPanel from "../components/NaverLoginPanel";
import KakaoNotifyPanel from "../components/KakaoNotifyPanel";

type HealthState = { status: "loading" } | { status: "ok" } | { status: "error"; message: string };

const KAKAO_REDIRECT_MESSAGE: Record<string, string> = {
  connected: "카카오톡 연결이 완료됐습니다.",
  denied: "카카오 로그인 동의가 취소됐습니다.",
  error: "카카오 연결 중 오류가 발생했습니다. 다시 시도해주세요.",
};

export default function Home() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(() => setHealth({ status: "ok" }))
      .catch((err) => setHealth({ status: "error", message: String(err) }));
  }, []);

  const kakaoParam = new URLSearchParams(window.location.search).get("kakao");

  return (
    <div>
      <h2>글 작성</h2>
      <p>
        서버 상태:{" "}
        {health.status === "loading" && <span className="status-pill">확인 중...</span>}
        {health.status === "ok" && <span className="status-pill ok">정상</span>}
        {health.status === "error" && <span className="status-pill error">연결 실패 ({health.message})</span>}
      </p>

      {kakaoParam && KAKAO_REDIRECT_MESSAGE[kakaoParam] && (
        <p>
          <span className={`status-pill ${kakaoParam === "connected" ? "ok" : "error"}`}>
            {KAKAO_REDIRECT_MESSAGE[kakaoParam]}
          </span>
        </p>
      )}

      <NaverLoginPanel />
      <KakaoNotifyPanel />

      <section>
        <h3>업체 정보 등록</h3>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          한 번만 입력해두면 모든 글에 자동으로 재사용됩니다. 인사말과 해시태그는 매 글에 항상
          붙고, 톡톡·예약·주소 링크는 아래 "글 종류별 첨부 요소"에서 홍보성/정보성 각각 켜고 끌
          수 있습니다.
        </p>
        <BusinessProfileForm />
      </section>

      <section>
        <h3>새 글 작성</h3>
        <NewPostForm />
      </section>
    </div>
  );
}
