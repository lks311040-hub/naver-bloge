import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PostRequestSchema, POST_STATUSES, type PostStatus } from "@app/shared";
import { UPLOADS_DIR } from "../../config/paths.js";
import { createAndGenerate, regeneratePost } from "./service.js";
import { setBlockMedia, updateLinkBlock } from "./blockOps.js";
import { approvePost, getPost, listPosts, markPostPublished } from "./repo.js";
import { enqueueEditorAutofill } from "../automation/editorAutofill.js";
import { getNaverSession } from "../naver-session/repo.js";
import { detectPublishedPosts } from "./detectPublished.js";

export const postsRouter = Router();

postsRouter.post("/generate", (req, res) => {
  const parsed = PostRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  createAndGenerate(parsed.data)
    .then((post) => res.status(202).json(post))
    .catch((err) => {
      res.status(500).json({ error: "generate_failed", message: String(err) });
    });
});

// Retries generation for a post whose generation itself failed (as opposed
// to an autofill failure, which just calls /autofill again). Reuses the
// post's already-stored request fields.
postsRouter.post("/:id/regenerate", (req, res) => {
  regeneratePost(req.params.id!)
    .then((result) => {
      if (!result.ok) {
        res.status(result.error === "post_not_found" ? 404 : 500).json({ error: result.error });
        return;
      }
      res.status(202).json({ ok: true });
    })
    .catch((err) => {
      res.status(500).json({ error: "regenerate_failed", message: String(err) });
    });
});

postsRouter.get("/", (req, res) => {
  const statusParam = req.query.status;
  if (statusParam !== undefined) {
    if (typeof statusParam !== "string" || !POST_STATUSES.includes(statusParam as PostStatus)) {
      res.status(400).json({ error: "invalid_status" });
      return;
    }
    res.json(listPosts(statusParam as PostStatus));
    return;
  }
  res.json(listPosts());
});

postsRouter.get("/:id", (req, res) => {
  const post = getPost(req.params.id);
  if (!post) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(post);
});

// Uploaded photo/video for an image_placeholder/video_placeholder block.
// Stored at server/data/uploads/{postId}/{blockId}.{ext}, served back via
// express.static at /media/{postId}/{filename} (mounted in src/index.ts).
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(UPLOADS_DIR, req.params.id!);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      cb(null, `${req.params.blockId}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB — generous for phone-camera video clips
});

postsRouter.post("/:id/media/:blockId", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "no_file" });
    return;
  }
  const relativePath = `${req.params.id}/${req.file.filename}`;
  const result = setBlockMedia(req.params.id!, req.params.blockId!, relativePath);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.post);
});

const LinkBlockPatchSchema = z.object({
  label: z.string().optional(),
  url: z.string().optional(),
});

postsRouter.patch("/:id/blocks/:blockId/link", (req, res) => {
  const parsed = LinkBlockPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  const result = updateLinkBlock(req.params.id, req.params.blockId, parsed.data);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.post);
});

postsRouter.post("/:id/approve", (req, res) => {
  const post = getPost(req.params.id);
  if (!post) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  approvePost(req.params.id);
  res.json(getPost(req.params.id));
});

// Kicks off the Playwright autofill run (queued through automationQueue).
// Fire-and-forget over HTTP: the client subscribes to GET /api/events/:runId
// for live progress and re-polls the post for its final status. The run
// never clicks 발행 — it leaves the browser window open for manual publish.
postsRouter.post("/:id/autofill", (req, res) => {
  const post = getPost(req.params.id);
  if (!post) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  // 로그인 여부만은 enqueue 전에 미리 본다. 아래는 fire-and-forget이라 실행이
  // 곧바로 실패하면 그 사유가 progressBus로만 나가는데, 클라이언트는 202를 받은
  // *뒤에야* SSE를 구독한다. progressBus는 버퍼가 없어서(emit-to-nobody) 그
  // 사이에 나간 로그는 그냥 사라지고, 화면에는 버튼을 눌러도 아무 일도 안
  // 일어난 것처럼 보인다 — 실제로 이것 때문에 한참 헤맸다. 미리 검사해서 HTTP
  // 에러로 돌려주면 react-query의 error 상태로 화면에 그대로 뜬다.
  const session = getNaverSession();
  if (!session.blogId || !session.storageStatePath || !fs.existsSync(session.storageStatePath)) {
    res.status(409).json({
      error: "not_logged_in",
      message: "네이버 로그인이 필요합니다. 홈 화면의 '네이버 로그인' 버튼을 먼저 눌러주세요.",
    });
    return;
  }

  const runId = randomUUID();
  enqueueEditorAutofill(req.params.id!, runId).catch((err) => {
    console.error("[autofill] unexpected failure outside the run's own error handling:", err);
  });
  res.status(202).json({ runId });
});

// 예약 발행을 걸어두고 창을 닫으면 붙여넣을 주소가 없어서 "발행 대기"에 그대로
// 묶인다. 블로그 공개 RSS를 읽어 제목이 같은 글을 찾아 주소를 대신 채워준다.
// Playwright/로그인을 쓰지 않으므로 automationQueue와 무관하다.
postsRouter.post("/detect-published", (_req, res) => {
  detectPublishedPosts()
    .then((result) => res.json(result))
    .catch((err) => {
      res.status(502).json({
        error: "detect_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    });
});

const MarkPublishedSchema = z.object({ publishedUrl: z.string().min(1) });

// Pure DB write — no Playwright involvement. The human already published
// manually in the still-open browser window from the autofill run.
postsRouter.post("/:id/mark-published", (req, res) => {
  const parsed = MarkPublishedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
    return;
  }
  const post = getPost(req.params.id);
  if (!post) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const updated = markPostPublished(req.params.id!, parsed.data.publishedUrl);
  res.json(updated);
});
