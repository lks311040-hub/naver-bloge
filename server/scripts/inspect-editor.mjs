import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STORAGE_STATE = path.join(ROOT, "data", "naver-storage-state.json");
const OUT_DIR = path.join(ROOT, "..", "tmp-inspect");
fs.mkdirSync(OUT_DIR, { recursive: true });

const blogId = process.argv[2] || "accel_piano2087";
const RESERVATION_URL = "https://booking.naver.com/booking/13/bizes/957913";

const browser = await chromium.launch({ channel: "msedge", headless: false });
const context = await browser.newContext({ storageState: STORAGE_STATE });
const page = await context.newPage();

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
  await page.waitForTimeout(500);

  // click into body, type the reservation URL alone as plain text
  await mainFrame.locator(".se-title-text .se-text-paragraph").click();
  await page.keyboard.type("테스트 제목");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  await page.keyboard.type(`예약 안내: ${RESERVATION_URL}`);
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000); // give Naver time to auto-expand into a preview card

  await page.screenshot({ path: path.join(OUT_DIR, "diag-reservation-url-only.png"), fullPage: false });

  const bodyHtml = await mainFrame.evaluate(() => {
    const el = document.querySelector(".se-main-container");
    return el ? el.innerHTML.slice(-4000) : "not found";
  });
  fs.writeFileSync(path.join(OUT_DIR, "diag-reservation-body.html"), bodyHtml);
  console.log("body html tail written");
} catch (err) {
  console.error("error:", err.message, err.stack);
} finally {
  await page.waitForTimeout(2000);
  await browser.close();
  console.log("--- browser closed ---");
}
