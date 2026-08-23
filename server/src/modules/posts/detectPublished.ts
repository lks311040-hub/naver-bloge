import { getNaverSession } from "../naver-session/repo.js";
import { listPosts, markPostPublished } from "./repo.js";

/**
 * "발행 대기"로 묶여 있는 글이 사실은 블로그에 이미 올라가 있는지 확인해서,
 * 맞으면 글 주소를 자동으로 기록한다.
 *
 * 왜 필요한가: 원래는 사람이 발행 직후 주소를 복사해 붙여넣는 흐름만 있었다.
 * 그런데 실제 운영에서는 에디터에서 **예약 발행**을 걸어두고 창을 닫는 일이
 * 훨씬 많다 — 그 시점엔 글이 아직 없으니 붙여넣을 주소 자체가 없고, 나중에
 * 발행되고 나면 대시보드로 돌아와 주소를 붙일 이유를 잊는다. 그 결과 발행
 * 이력이 텅 빈 채로 "발행 대기"만 계속 쌓였다.
 *
 * Playwright도 로그인도 쓰지 않는다. 블로그 공개 RSS만 읽으면 되므로 자동화
 * 모듈과 무관하고, 브라우저 큐를 점유하지도 않는다.
 */

const RSS_TIMEOUT_MS = 15000;

export interface DetectedMatch {
  postId: string;
  title: string;
  publishedUrl: string;
  /** exact = 제목이 그대로, prefix = 앞부분만 일치 (에디터에서 제목 뒤를 고친 경우) */
  how: "exact" | "prefix";
}

export interface DetectPublishedResult {
  matched: DetectedMatch[];
  /** 아직 블로그에서 못 찾은 글 — 정말 발행 전이거나, 제목을 많이 바꾼 경우다. */
  unmatchedTitles: string[];
  feedCount: number;
}

interface FeedItem {
  title: string;
  link: string;
}

/** 제목 비교용 정규화 — 공백/대소문자 차이는 무시한다. */
function normalize(title: string): string {
  return title.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * 이 블로그는 제목 뒤에 "(시흥시능곡동피아노/...)" 같은 키워드를 덧붙이는 일이
 * 잦아서, 앞부분이 충분히 길게 겹치면 같은 글로 본다. 짧은 제목에 이 규칙을
 * 쓰면 엉뚱한 글이 걸리므로 최소 길이를 둔다.
 */
const PREFIX_MATCH_LEN = 20;

function matches(a: string, b: string): "exact" | "prefix" | undefined {
  if (a === b) return "exact";
  if (a.length >= PREFIX_MATCH_LEN && b.length >= PREFIX_MATCH_LEN) {
    if (a.startsWith(b.slice(0, PREFIX_MATCH_LEN)) || b.startsWith(a.slice(0, PREFIX_MATCH_LEN))) {
      return "prefix";
    }
  }
  return undefined;
}

function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]!;
    const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1];
    const link = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(block)?.[1];
    if (title && link) items.push({ title: title.trim(), link: link.trim() });
  }
  return items;
}

/** RSS가 붙여주는 추적 파라미터를 떼고 깔끔한 글 주소만 남긴다. */
function cleanUrl(link: string): string {
  const q = link.indexOf("?");
  return q === -1 ? link : link.slice(0, q);
}

export async function detectPublishedPosts(): Promise<DetectPublishedResult> {
  const { blogId } = getNaverSession();
  if (!blogId) {
    throw new Error("블로그 아이디를 모릅니다. 홈 화면에서 네이버 로그인을 먼저 해주세요.");
  }

  const res = await fetch(`https://rss.blog.naver.com/${blogId}.xml`, {
    signal: AbortSignal.timeout(RSS_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`블로그 글 목록을 가져오지 못했습니다 (HTTP ${res.status}).`);
  }
  const feed = parseFeed(await res.text());

  const waiting = listPosts("filled_awaiting_publish");
  const matched: DetectedMatch[] = [];
  const unmatchedTitles: string[] = [];

  for (const post of waiting) {
    const postTitle = normalize(post.title ?? "");
    if (!postTitle) continue;

    // exact를 prefix보다 먼저 찾는다 — 비슷한 제목이 여러 개일 때 정확한 쪽이 이긴다.
    let hit: { item: FeedItem; how: "exact" | "prefix" } | undefined;
    for (const item of feed) {
      const how = matches(postTitle, normalize(item.title));
      if (!how) continue;
      if (how === "exact") {
        hit = { item, how };
        break;
      }
      hit ??= { item, how };
    }

    if (!hit) {
      unmatchedTitles.push(post.title ?? "(제목 없음)");
      continue;
    }

    const publishedUrl = cleanUrl(hit.item.link);
    markPostPublished(post.id, publishedUrl);
    matched.push({ postId: post.id, title: post.title ?? "", publishedUrl, how: hit.how });
  }

  return { matched, unmatchedTitles, feedCount: feed.length };
}
