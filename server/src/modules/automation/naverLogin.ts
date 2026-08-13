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
    let loggedIn = hasSavedState && (await context.cookies("https://www.naver.com")).some((c) => c.name === "NID_SES");

    if (loggedIn) {
      log("저장된 세션을 확인하는 중...");
    } else {
      log("네이버 로그인 페이지를 열었습니다. 새로 열린 창에서 직접 로그인해주세요.");
      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

      log("로그인을 기다리는 중입니다 (최대 5분)...");
      loggedIn = await waitForLoginCookie(context, LOGIN_TIMEOUT_MS);
      if (!loggedIn) {
        log("시간 초과 — 로그인이 감지되지 않았습니다. 창을 닫고 다시 시도해주세요.", "warn");
        return { ok: false, error: "timeout" };
      }
    }

    // Persist the session immediately once login is confirmed — even if
    // blogId detection below fails, the login itself is never lost, and a
    // retry can reuse it instead of asking the user to log in again.
    await context.storageState({ path: NAVER_STORAGE_STATE_PATH });

    log("로그인이 감지되었습니다. 블로그 아이디를 확인하는 중...");
    await page.goto("https://blog.naver.com/", { waitUntil: "networkidle" }).catch(() => {
      // networkidle can time out on pages with long-polling/analytics
      // connections — the URL/content checks below still work either way.
    });
    const blogId = await waitForBlogIdRedirect(page, BLOG_ID_TIMEOUT_MS);
    if (!blogId) {
      log(
        `블로그 아이디를 확인하지 못했습니다 (현재 페이지: ${page.url()}, 제목: "${await page.title().catch(() => "?")}"). ` +
          `로그인 세션은 저장되었으니 다시 시도할 때 재로그인은 필요 없습니다.`,
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
