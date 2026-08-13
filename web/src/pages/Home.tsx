import { useEffect, useState } from "react";
import BusinessProfileForm from "../components/BusinessProfileForm";
import NewPostForm from "../components/NewPostForm";
import NaverLoginPanel from "../components/NaverLoginPanel";

type HealthState = { status: "loading" } | { status: "ok" } | { status: "error"; message: string };

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

  return (
    <div>
      <h2>홍보글 작성</h2>
      <p>
        서버 상태:{" "}
        {health.status === "loading" && <span className="status-pill">확인 중...</span>}
        {health.status === "ok" && <span className="status-pill ok">정상</span>}
        {health.status === "error" && <span className="status-pill error">연결 실패 ({health.message})</span>}
      </p>

      <NaverLoginPanel />

      <section>
        <h3>업체 정보 등록</h3>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          한 번만 입력해두면 모든 글에 자동으로 재사용됩니다 (인사말/톡톡/예약링크/해시태그는
          매 글 앞뒤에 고정으로 삽입됩니다).
        </p>
        <BusinessProfileForm />
      </section>

      <section>
        <h3>새 홍보글 작성</h3>
        <NewPostForm />
      </section>
    </div>
  );
}
