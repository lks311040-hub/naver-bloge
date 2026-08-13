import type { Block, PostRecord } from "@app/shared";
import { getPost, updateBlocks } from "./repo.js";

export type BlockOpResult =
  | { ok: true; post: PostRecord }
  | { ok: false; status: 404; error: "post_not_found" | "block_not_found" }
  | { ok: false; status: 400; error: "wrong_block_type" };

function mutateBlock(
  postId: string,
  blockId: string,
  expectedTypes: Array<Block["type"]>,
  mutate: (block: Block) => Block,
): BlockOpResult {
  const post = getPost(postId);
  if (!post) return { ok: false, status: 404, error: "post_not_found" };

  const index = post.blocks.findIndex((b) => b.id === blockId);
  if (index === -1) return { ok: false, status: 404, error: "block_not_found" };

  const target = post.blocks[index]!;
  if (!expectedTypes.includes(target.type)) {
    return { ok: false, status: 400, error: "wrong_block_type" };
  }

  const nextBlocks = [...post.blocks];
  nextBlocks[index] = mutate(target);
  updateBlocks(postId, nextBlocks);

  return { ok: true, post: getPost(postId)! };
}

/** Draft review screen — user uploads a real photo/video into a placeholder slot. */
export function setBlockMedia(postId: string, blockId: string, filePath: string): BlockOpResult {
  return mutateBlock(
    postId,
    blockId,
    ["image_placeholder", "video_placeholder"],
    (b) => ({ ...b, filePath }) as Block,
  );
}

/** Draft review screen — edit label/url for talktalk/related_post/reservation blocks. */
export function updateLinkBlock(
  postId: string,
  blockId: string,
  patch: { label?: string; url?: string },
): BlockOpResult {
  return mutateBlock(postId, blockId, ["link_block"], (b) => ({ ...b, ...patch }) as Block);
}
