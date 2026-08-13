import fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { progressBus, type ProgressLevel } from "../sse/index.js";
import { automationQueue } from "./queue.js";
import { NAVER_STORAGE_STATE_PATH } from "../../config/paths.js";
import { saveNaverSession } from "../naver-session/repo.js";

const LOGIN_URL = "https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fwww.naver.com%2F";
// Matches ANY blog.naver.com URL carrying a blogId query param — not just
// literally "MyBlog.naver" — since we're not 100% sure which page the
// current logged-in landing flow uses. Deliberately NOT matching bare
// `blog.naver.com/` with no blogId param (that also renders for the
// logged-out/new feed UI and would be a false positive).
const BLOG_ID_PATTERN = /blog\.naver\.com\/[^"'\s?]*\?[^"'\s]*blogId=([a-zA-Z0-9_-]+)/;
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

/** Navigates to blog.naver.com and waits for the blogId to show up in the
 * URL/HTML. Returns undefined (never throws) if it doesn't within the
 * timeout — the caller decides what that means. */
async function tryDetectBlogId(page: Page): Promise<string | undefined> {
  await page.goto("https://blog.naver.com/", { waitUntil: "networkidle" }).catch(() => {
    // networkidle can time out on pages with long-polling/analytics
    // connections — the URL/content checks below still work either way.
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

/** Checks both the current URL and the page's rendered HTML for a
 * blog.naver.com link carrying a blogId — whichever surfaces one first. */
async function waitForBlogIdRedirect(page: Page, timeoutMs: number): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const urlMatch = BLOG_ID_PATTERN.exec(page.url());
    if (urlMatch) return urlMatch[1];

    const html = await page.content().catch(() => "");
    const htmlMatch = BLOG_ID_PATTERN.exec(html);
    if (htmlMatch) return htmlMatch[1];

    await sleep(500);
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
