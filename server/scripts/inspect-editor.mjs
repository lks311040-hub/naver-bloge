import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STORAGE_STATE = path.join(ROOT, "data", "naver-storage-state.json");
const OUT_DIR = path.join(ROOT, "..", "tmp-inspect");
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: false });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 900, height: 1000 } });
const page = await context.newPage();

try {
  // Go to the blog's post list and click the AI-generated post to open it for real.
  await page.goto("https://blog.naver.com/accel_piano2087", { waitUntil: "networkidle", timeout: 25000 });
  await page.waitForTimeout(1500);
  const mainFrame = page.frame({ name: "mainFrame" });

  const postLink = mainFrame.locator("text=승지초피아노").first();
  await postLink.click({ timeout: 15000 });
  await page.waitForTimeout(2000);

  console.log("url after click:", page.url());
  await page.screenshot({ path: path.join(OUT_DIR, "post-top.png"), fullPage: false });

  // scroll to top area with author info (usually right below title or in a floating badge)
  const html = await page.frame({ name: "mainFrame" })?.evaluate(() => document.body.innerText.slice(0, 2500));
  fs.writeFileSync(path.join(OUT_DIR, "post-top.txt"), html ?? "NO MAINFRAME");
  console.log(html?.slice(0, 1500));

  // scroll to bottom for author widget / place widget
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "post-mid.png"), fullPage: false });

  await page.mouse.wheel(0, 6000);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "post-bottom.png"), fullPage: false });
} catch (err) {
  console.error("error:", err.message, err.stack);
} finally {
  await browser.close();
  console.log("--- browser closed ---");
}
