import fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { progressBus, type ProgressLevel } from "../sse/index.js";
import { automationQueue } from "./queue.js";
import { NAVER_STORAGE_STATE_PATH } from "../../config/paths.js";
import { saveNaverSession } from "../naver-session/repo.js";

const LOGIN_URL = "https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fwww.naver.com%2F";

/**
 * "내 블로그" 바로가기. 예전에는 https://blog.naver.com/ 이 로그인한 사람의
 * 블로그로 리다이렉트해줬지만, 지금은 남의 글이 뜨는 홈피드
 * (section.blog.naver.com/BlogHome.naver)로 보낸다 — 그 페이지에는 내 blogId가
 * 아예 없고, 대신 모르는 사람들의 blog.naver.com 링크만 잔뜩 있다. MyBlog.naver
 * 는 여전히 내 블로그로 정확히 보내준다. (2026-08 라이브 확인)
 */
const MY_BLOG_URL = "https://blog.naver.com/MyBlog.naver";

/**
 * 리다이렉트가 끝난 주소 `https://blog.naver.com/<blogId>` 에서 아이디를 뽑는다.
 * **페이지 URL에만** 쓸 것 — HTML에 이 형태를 적용하면 홈피드에 널린 남의
 * 블로그 링크를 내 아이디로 착각한다.
 */
const BLOG_ID_IN_PATH = /^https?:\/\/blog\.naver\.com\/([a-zA-Z0-9_-]+)(?:[/?#]|$)/;

/** `?blogId=xxx` 형태의 보조 경로. 내 블로그 페이지 안에서만 참고한다. */
const BLOG_ID_IN_QUERY = /[?&]blogId=([a-zA-Z0-9_-]+)/;

/** blog.naver.com/<여기>가 사람 아이디가 아닌, 네이버가 쓰는 고정 경로들. */
const RESERVED_PATH_SEGMENTS = new Set([
  "MyBlog",
  "BlogHome",
  "PostList",
  "PostView",
  "market",
  "blogpeople",
]);
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const BLOG_ID_TIMEOUT_MS = 20 * 1000;
const POLL_INTERVAL_MS = 1000;

export interface NaverLoginResult {
  ok: boolean;
  blogId?: string;
  error?: string;
}

/** Queued through automationQueue so a second click while one login is in
 * flight waits behind it instead of opening a second browser window. */
export function enqueueNaverLogin(runId: string): Promise<NaverLoginResult> {
  return automationQueue.add(() => runNaverLogin(runId)) as Promise<NaverLoginResult>;
}

async function runNaverLogin(runId: string): Promise<NaverLoginResult> {
  const log = (message: string, level: ProgressLevel = "info") => progressBus.publish(runId, message, level);

  log("브라우저를 여는 중...");
  const browser = await chromium.launch({ channel: "msedge", headless: false });
  const hasSavedState = fs.existsSync(NAVER_STORAGE_STATE_PATH);
  const context = await browser.newContext(hasSavedState ? { storageState: NAVER_STORAGE_STATE_PATH } : {});
  const page = await context.newPage();

  try {
    const hasSavedCookie =
      hasSavedState && (await context.cookies("https://www.naver.com")).some((c) => c.name === "NID_SES");

    if (hasSavedCookie) {
      log("저장된 세션을 확인하는 중...");
    } else {
      await runFreshLogin(page, context, log);
    }

    // Persist the session immediately once login is confirmed — even if
    // blogId detection below fails, the login itself is never lost, and a
    // retry can reuse it instead of asking the user to log in again.
    await context.storageState({ path: NAVER_STORAGE_STATE_PATH });

    log("블로그 아이디를 확인하는 중...");
    let blogId = await tryDetectBlogId(page);

    // A locally-cached NID_SES cookie doesn't guarantee Naver's server
    // still honors it — sessions expire server-side after some idle time,
    // and a stale-but-present cookie can silently land on a generic
    // logged-out-looking page (BlogHome.naver, or even nid.naver.com's
    // login form) instead of erroring outright. Rather than fail here and
    // make the user manually retry, fall back to a full fresh login
    // automatically — but only once, so a genuinely broken flow doesn't
    // loop forever.
    if (!blogId && hasSavedCookie) {
      log("저장된 세션이 만료된 것 같습니다. 다시 로그인해주세요.", "warn");
      await runFreshLogin(page, context, log);
      await context.storageState({ path: NAVER_STORAGE_STATE_PATH });
      log("블로그 아이디를 다시 확인하는 중...");
      blogId = await tryDetectBlogId(page);
    }

    if (!blogId) {
      log(
        `블로그 아이디를 확인하지 못했습니다 (현재 페이지: ${page.url()}, 제목: "${await page.title().catch(() => "?")}").`,
        "error",
      );
      return { ok: false, error: "blog_id_not_found" };
    }

    saveNaverSession({ blogId, storageStatePath: NAVER_STORAGE_STATE_PATH });
    log(`로그인 완료: ${blogId}`, "done");
    return { ok: true, blogId };
  } catch (err) {
    log(`오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`, "error");
    return { ok: false, error: String(err) };
  } finally {
    await browser.close();
  }
}

type LogFn = (message: string, level?: ProgressLevel) => void;

/** Navigates to the real Naver login form and waits for a human to log in. */
async function runFreshLogin(page: Page, context: BrowserContext, log: LogFn): Promise<void> {
  log("네이버 로그인 페이지를 열었습니다. 새로 열린 창에서 직접 로그인해주세요.");
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

  log("로그인을 기다리는 중입니다 (최대 5분)...");
  const loggedIn = await waitForLoginCookie(context, LOGIN_TIMEOUT_MS);
  if (!loggedIn) {
    throw new Error("timeout — 로그인이 감지되지 않았습니다");
  }
}

/** Navigates to the "내 블로그" shortcut and waits for the blogId to show up.
 * Returns undefined (never throws) if it doesn't within the timeout — the
 * caller decides what that means. */
async function tryDetectBlogId(page: Page): Promise<string | undefined> {
  await page.goto(MY_BLOG_URL, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {
    // 느린 로딩/애널리틱스로 타임아웃이 나도, 아래 URL 검사는 그대로 동작한다.
  });
  return waitForBlogIdRedirect(page, BLOG_ID_TIMEOUT_MS);
}

async function waitForLoginCookie(context: BrowserContext, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cookies = await context.cookies("https://www.naver.com");
    if (cookies.some((c) => c.name === "NID_SES")) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

/**
 * 리다이렉트가 끝나기를 기다리며 blogId를 찾는다. 순서가 중요하다:
 *  1) 페이지 URL의 경로 — 가장 믿을 만하다. MyBlog.naver가 데려다준 곳이니
 *     정의상 내 블로그다.
 *  2) 페이지 URL의 ?blogId= 쿼리.
 *  3) 마지막으로 HTML 안의 ?blogId= — 단, 내 블로그 도메인(blog.naver.com)에
 *     있을 때만. 홈피드(section.blog.naver.com)에서 HTML을 뒤지면 남의 블로그를
 *     내 것으로 착각할 수 있어서 아예 보지 않는다.
 */
async function waitForBlogIdRedirect(page: Page, timeoutMs: number): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = page.url();

    const pathMatch = BLOG_ID_IN_PATH.exec(url);
    if (pathMatch && !RESERVED_PATH_SEGMENTS.has(pathMatch[1]!)) return pathMatch[1];

    const queryMatch = BLOG_ID_IN_QUERY.exec(url);
    if (queryMatch) return queryMatch[1];

    if (url.startsWith("https://blog.naver.com/")) {
      const html = await page.content().catch(() => "");
      const htmlMatch = BLOG_ID_IN_QUERY.exec(html);
      if (htmlMatch) return htmlMatch[1];
    }

    await sleep(500);
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
