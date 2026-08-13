import { NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import KeywordIdeas from "./pages/KeywordIdeas";
import Drafts from "./pages/Drafts";
import DraftReview from "./pages/DraftReview";
import Schedule from "./pages/Schedule";
import PublishHistory from "./pages/PublishHistory";

const NAV_ITEMS = [
  { to: "/", label: "홍보글 작성", end: true },
  { to: "/keywords", label: "키워드 수집" },
  { to: "/drafts", label: "초안" },
  { to: "/schedule", label: "예약" },
  { to: "/history", label: "발행 이력" },
] as const;

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>블로그 자동화</h1>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/keywords" element={<KeywordIdeas />} />
          <Route path="/drafts" element={<Drafts />} />
          <Route path="/drafts/:postId" element={<DraftReview />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/history" element={<PublishHistory />} />
        </Routes>
      </main>
    </div>
  );
}
