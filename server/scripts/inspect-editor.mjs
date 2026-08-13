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

try {
  await page.goto(`https://blog.naver.com/${blogId}?Redirect=Write`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log("top url:", page.url());
  console.log("top title:", await page.title());
  console.log(
    "frames:",
    page.frames().map((f) => ({ name: f.name(), url: f.url() })),
  );

  await page.screenshot({ path: path.join(OUT_DIR, "diag-write-page.png"), fullPage: false });

  const bodySample = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  fs.writeFileSync(path.join(OUT_DIR, "diag-top-text.txt"), bodySample);
  console.log("top body text sample:\n", bodySample);
} catch (err) {
  console.error("error:", err.message, err.stack);
} finally {
  await browser.close();
  console.log("--- browser closed ---");
}
