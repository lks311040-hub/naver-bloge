import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Block, PostRecord } from "@app/shared";
import MarkupText from "../MarkupText";
import { updateLinkBlock, uploadBlockMedia } from "../../api/posts";

const LINK_KIND_LABEL: Record<string, string> = {
  talktalk: "네이버 톡톡",
  related_post: "함께 읽으면 좋은 글",
  reservation: "예약",
  address: "오시는 길",
};

interface BlockRendererProps {
  block: Block;
  postId: string;
  onUpdated: (post: PostRecord) => void;
}

export default function BlockRenderer({ block, postId, onUpdated }: BlockRendererProps) {
  switch (block.type) {
    case "paragraph":
      return (
        <p style={{ lineHeight: 1.7 }}>
          <MarkupText text={block.text} />
        </p>
      );
    case "heading":
      return (
        <h4 style={{ marginTop: 24 }}>
          <MarkupText text={block.text} />
        </h4>
      );
    case "divider":
      return <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "20px 0" }} />;
    case "image_placeholder":
    case "video_placeholder":
      return <MediaBlock block={block} postId={postId} onUpdated={onUpdated} />;
    case "emoticon_placeholder":
      return (
        <p style={{ color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>
          🙂 이모티콘 자리 — {block.imageQuery} (자동입력 단계에서 삽입됩니다)
        </p>
      );
    case "link_block":
      return <LinkBlockEditor block={block} postId={postId} onUpdated={onUpdated} />;
    case "hashtags":
      return (
        <p style={{ color: "#2563eb" }}>
          {block.tags.map((tag) => (
            <span key={tag} style={{ marginRight: 8 }}>
              {tag}
            </span>
          ))}
        </p>
      );
    default:
      return null;
  }
}

function MediaBlock({
  block,
  postId,
  onUpdated,
}: {
  block: Extract<Block, { type: "image_placeholder" | "video_placeholder" }>;
  postId: string;
  onUpdated: (post: PostRecord) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isVideo = block.type === "video_placeholder";

  const mutation = useMutation({
    mutationFn: (file: File) => uploadBlockMedia(postId, block.id, file),
    onSuccess: onUpdated,
  });

  return (
    <div style={{ border: "1px dashed #9ca3af", borderRadius: 8, padding: 12, margin: "12px 0" }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6b7280" }}>
        {isVideo ? "🎬 영상 자리" : "🖼 사진 자리"} — {block.imageQuery}
      </p>
      {block.filePath &&
        (isVideo ? (
          <video src={`/media/${block.filePath}`} controls style={{ maxWidth: "100%", maxHeight: 240 }} />
        ) : (
          <img src={`/media/${block.filePath}`} alt="" style={{ maxWidth: "100%", maxHeight: 240 }} />
        ))}
      <div style={{ marginTop: 8 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={isVideo ? "video/*" : "image/*"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) mutation.mutate(file);
          }}
        />
        {mutation.isPending && <span className="status-pill" style={{ marginLeft: 8 }}>업로드 중...</span>}
        {mutation.isError && (
          <span className="status-pill error" style={{ marginLeft: 8 }}>{String(mutation.error)}</span>
        )}
      </div>
    </div>
  );
}

function LinkBlockEditor({
  block,
  postId,
  onUpdated,
}: {
  block: Extract<Block, { type: "link_block" }>;
  postId: string;
  onUpdated: (post: PostRecord) => void;
}) {
  const [label, setLabel] = useState(block.label);
  const [url, setUrl] = useState(block.url);

  const mutation = useMutation({
    mutationFn: () => updateLinkBlock(postId, block.id, { label, url }),
    onSuccess: onUpdated,
  });

  const dirty = label !== block.label || url !== block.url;

  return (
    <div style={{ border: "1px solid #dbeafe", background: "#eff6ff", borderRadius: 8, padding: 12, margin: "12px 0" }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>
        🔗 {LINK_KIND_LABEL[block.kind] ?? block.kind}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="안내 문구" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="링크 URL" />
      </div>
      {dirty && (
        <button type="button" style={{ marginTop: 8 }} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "저장 중..." : "저장"}
        </button>
      )}
      {mutation.isError && (
        <p className="status-pill error" style={{ marginTop: 8 }}>{String(mutation.error)}</p>
      )}
    </div>
  );
}
