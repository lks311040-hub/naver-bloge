import { POST_TYPES, type AttachmentSettings, type AttachmentToggles, type PostType } from "@app/shared";

const POST_TYPE_LABEL: Record<PostType, string> = {
  promotional: "홍보성 글",
  informational: "정보성 글",
};

const POST_TYPE_HINT: Record<PostType, string> = {
  promotional: "학원을 직접 알리는 글",
  informational: "홈피드 노출을 노리는 정보 글",
};

/** 열 순서 = 실제로 글에 삽입되는 순서. */
const ITEMS = [
  { key: "talktalk", label: "톡톡 문의", urlLabel: "네이버 톡톡 URL" },
  { key: "reservation", label: "예약하기", urlLabel: "네이버 예약 링크" },
  { key: "address", label: "주소(오시는 길)", urlLabel: "주소 링크" },
] as const satisfies ReadonlyArray<{ key: keyof AttachmentToggles; label: string; urlLabel: string }>;

interface AttachmentDashboardProps {
  value: AttachmentSettings;
  onChange: (next: AttachmentSettings) => void;
  /** 켰는데 URL이 비어 있으면 아무것도 안 붙으므로, 그 상태를 바로 알려주려고 받는다. */
  urls: Record<keyof AttachmentToggles, string>;
}

export default function AttachmentDashboard({ value, onChange, urls }: AttachmentDashboardProps) {
  function toggle(postType: PostType, item: keyof AttachmentToggles) {
    onChange({
      ...value,
      [postType]: { ...value[postType], [item]: !value[postType][item] },
    });
  }

  const missingUrls = ITEMS.filter(
    (item) => !urls[item.key].trim() && POST_TYPES.some((pt) => value[pt][item.key]),
  );

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
      <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14 }}>글 종류별 첨부 요소</p>
      <p style={{ margin: "0 0 12px", color: "#6b7280", fontSize: 13 }}>
        체크한 항목만 글 아래쪽에 링크로 붙습니다. 위 입력칸의 URL이 비어 있으면 체크해도 붙지
        않습니다.
      </p>

      <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 16px 6px 0", fontWeight: 600 }}>글 종류</th>
            {ITEMS.map((item) => (
              <th key={item.key} style={{ textAlign: "center", padding: "6px 12px", fontWeight: 600 }}>
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POST_TYPES.map((postType) => (
            <tr key={postType} style={{ borderTop: "1px solid #f3f4f6" }}>
              <td style={{ padding: "10px 16px 10px 0" }}>
                <div style={{ fontWeight: 600 }}>{POST_TYPE_LABEL[postType]}</div>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>{POST_TYPE_HINT[postType]}</div>
              </td>
              {ITEMS.map((item) => (
                <td key={item.key} style={{ textAlign: "center", padding: "10px 12px" }}>
                  {/* 네이티브 체크박스의 기본 토글에 의존하지 않고 label 전체의
                      onClick으로 처리한다 — Schedule.tsx의 요일 선택과 같은 이유
                      (라벨 클릭이 텍스트 드래그로 먹혀 조용히 무시되던 문제). */}
                  <label
                    onClick={(e) => {
                      e.preventDefault();
                      toggle(postType, item.key);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      userSelect: "none",
                      padding: 4,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={value[postType][item.key]}
                      readOnly
                      aria-label={`${POST_TYPE_LABEL[postType]}에 ${item.label} 붙이기`}
                    />
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {missingUrls.length > 0 && (
        <p style={{ margin: "12px 0 0", color: "#b45309", fontSize: 13 }}>
          ⚠ {missingUrls.map((item) => item.urlLabel).join(", ")}이(가) 비어 있어서, 체크해도 글에는
          붙지 않습니다.
        </p>
      )}
    </div>
  );
}
