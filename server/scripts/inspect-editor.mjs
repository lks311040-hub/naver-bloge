import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STORAGE_STATE = path.join(ROOT, "data", "naver-storage-state.json");
const OUT_DIR = path.join(ROOT, "..", "tmp-inspect");
fs.mkdirSync(OUT_DIR, { recursive: true });

const blogId = process.argv[2] || "accel_piano2087";

const browser = await chromium.launch({ channel: "msedge", headless: false });
const context = await browser.newContext({ storageState: STORAGE_STATE });
const page = await context.newPage();

async function insertStickerLikeApp(mainFrame) {
  const tiles = mainFrame.locator(".se-sidebar-element-sticker");
  if ((await tiles.count().catch(() => 0)) === 0) {
    await mainFrame.locator('[data-name="sticker"][data-group="documentToolbar"]').click();
    await page.waitForTimeout(1000);
  }
  const count = await tiles.count();
  console.log("tile count at insert time:", count);
  if (count === 0) return false;
  await tiles.nth(Math.floor(Math.random() * count)).click();
  await page.waitForTimeout(1200);
  return true;
}

try {
  await page.goto(`https://blog.naver.com/${blogId}?Redirect=Write`, { waitUntil: "networkidle", timeout: 25000 });
  await page.waitForTimeout(1500);
  const mainFrame = page.frame({ name: "mainFrame" });

  const popup = mainFrame.locator(".se-popup-alert-confirm");
  if (await popup.count().catch(() => 0)) {
    await popup.getByText("취소", { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
  }
  await mainFrame.locator(".se-help-panel-close-button").click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);

  await mainFrame.locator(".se-title-text .se-text-paragraph").first().click();
  await page.keyboard.type("t");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.keyboard.type("첫 문단 ");

  const ok1 = await insertStickerLikeApp(mainFrame);
  console.log("first insert ok:", ok1);
  await page.keyboard.type(" 사이 텍스트 ");
  const ok2 = await insertStickerLikeApp(mainFrame);
  console.log("second insert ok:", ok2);

  await page.screenshot({ path: path.join(OUT_DIR, "sticker-twice.png"), fullPage: false });
} catch (err) {
  console.error("error:", err.message, err.stack);
} finally {
  await browser.close();
  console.log("--- browser closed ---");
}
