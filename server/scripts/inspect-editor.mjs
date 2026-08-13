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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await page.goto(`https://blog.naver.com/${blogId}?Redirect=Write`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const mainFrame = page.frames().find((f) => f.name() === "mainFrame");
  if (!mainFrame) throw new Error("mainFrame not found");

  const resumePopup = mainFrame.locator(".se-popup-alert-confirm");
  if (await resumePopup.count()) {
    const cancelBtn = mainFrame.locator(".se-popup-alert-confirm .se-popup-button-cancel");
    if (await cancelBtn.count()) await cancelBtn.click().catch(() => {});
  }
  await sleep(500);

  // type a first paragraph so there's real content before the image (like real flow)
  await mainFrame.locator(".se-title-text .se-text-paragraph").click();
  await page.keyboard.type("테스트 제목");
  await page.keyboard.press("Enter");
  await sleep(300);
  await page.keyboard.type("첫 문단입니다.");
  await page.keyboard.press("Enter");
  await sleep(300);

  // insert free image, exactly like insertFreeImage()
  await mainFrame.locator('[data-name="search"][data-group="documentToolbar"]').click();
  await sleep(1000);
  await mainFrame.locator("text=전체 글감").first().click();
  await sleep(500);
  await mainFrame.locator("li:has-text('이미지'), [class*='item']:has-text('이미지')").first().click();
  await sleep(500);

  const input = mainFrame.locator('input[placeholder="글감을 검색해 보세요."]');
  await input.click();
  await input.fill("피아노 학원");
  await input.press("Enter");
  await sleep(2000);

  await mainFrame.locator(".se-flayer-photo-thumbnail").first().click({ force: true });
  await sleep(1500);

  console.log("--- after insert, BEFORE any cleanup ---");
  let popup = mainFrame.locator('[data-group="popupLayer"][data-name="se-popup-image-detail"]');
  console.log("popup count:", await popup.count());
  if (await popup.count()) {
    const info = await popup.first().evaluate((el) => ({
      html: el.outerHTML.slice(0, 2500),
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity,
      pointerEvents: getComputedStyle(el).pointerEvents,
      rect: el.getBoundingClientRect(),
    }));
    console.log("popup info:", JSON.stringify(info, null, 2));
  }

  // NOW mimic the real fillBlock() sequence for the very next "heading" block:
  // setTextFormat(mainFrame, "sectionTitle") -> click text-format button, then option
  console.log("--- attempting setTextFormat(sectionTitle) next, like real flow ---");
  try {
    await mainFrame.locator('[data-name="text-format"][data-group="propertyToolbar"]').click({ timeout: 8000 });
    console.log("text-format button click: OK");
  } catch (e) {
    console.log("text-format button click FAILED:", e.message.split("\n")[0]);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "diag-repro-after-textformat-attempt.png"), fullPage: false });

  popup = mainFrame.locator('[data-group="popupLayer"][data-name="se-popup-image-detail"]');
  console.log("popup count after attempt:", await popup.count());
  if (await popup.count()) {
    const info2 = await popup.first().evaluate((el) => ({
      html: el.outerHTML.slice(0, 3000),
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity,
      pointerEvents: getComputedStyle(el).pointerEvents,
      rect: el.getBoundingClientRect(),
    }));
    console.log("popup info2:", JSON.stringify(info2, null, 2));
  }
} catch (err) {
  console.error("error:", err.message, err.stack);
} finally {
  await page.waitForTimeout(3000);
  await browser.close();
  console.log("--- browser closed ---");
}
