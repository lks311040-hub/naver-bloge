import fs from "node:fs";
import path from "node:path";
import { chromium, type Frame, type Page } from "playwright";
import { parseInlineMarkup, type Block, type BusinessProfileRecord } from "@app/shared";
import { progressBus, type ProgressLevel } from "../sse/index.js";
import { automationQueue } from "./queue.js";
import { UPLOADS_DIR } from "../../config/paths.js";
import { getNaverSession } from "../naver-session/repo.js";
import { getBusinessProfile } from "../business-profile/repo.js";
import { getPost, markPostFailed, markPostFilledAwaitingPublish, markPostFilling } from "../posts/repo.js";
import { typeHuman, sleep } from "./humanType.js";
import { DEFAULT_FONT_SIZE, HIGHLIGHT_COLOR_HEX, SELECTORS } from "./selectors.js";
import { insertPlaceWidget } from "./placeWidget.js";

export interface AutofillResult {
  ok: boolean;
  error?: string;
}

type LogFn = (message: string, level?: ProgressLevel) => void;

export function enqueueEditorAutofill(postId: string, runId: string): Promise<AutofillResult> {
  return automationQueue.add(() => runEditorAutofill(postId, runId)) as Promise<AutofillResult>;
}

async function runEditorAutofill(postId: string, runId: string): Promise<AutofillResult> {
  const log: LogFn = (message, level = "info") => progressBus.publish(runId, message, level);

  const post = getPost(postId);
  if (!post) {
    log("글을 찾을 수 없습니다.", "error");
    return { ok: false, error: "post_not_found" };
  }

  const session = getNaverSession();
  if (!session.blogId || !session.storageStatePath || !fs.existsSync(session.storageStatePath)) {
    log("네이버 로그인이 필요합니다. 먼저 홈 화면에서 로그인해주세요.", "error");
    return { ok: false, error: "not_logged_in" };
  }

  const profile = getBusinessProfile();

  markPostFilling(postId);
  log("브라우저를 여는 중...");
  const browser = await chromium.launch({ channel: "msedge", headless: false });
  const context = await browser.newContext({ storageState: session.storageStatePath });
  const page = await context.newPage();

  // Deliberately NO try/finally browser.close() — on success the window
  // stays open for human review + manual publish; on failure it stays open
  // too, so a human can finish or diagnose manually rather than losing an
  // in-progress edit.
  try {
    log("네이버 블로그 글쓰기 화면을 여는 중...");
    await page.goto(`https://blog.naver.com/${session.blogId}?Redirect=Write`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(1500);

    const mainFrame = page.frame({ name: "mainFrame" });
    if (!mainFrame) {
      // Most common real-world cause: the saved session expired (Naver
      // sessions don't last forever — this reliably happens after a few
      // idle days) and the write-page navigation above landed on the
      // actual login form instead. Give a clear, actionable message
      // instead of the generic "frame not found".
      if (page.url().includes("nid.naver.com")) {
        throw new Error(
          "네이버 로그인 세션이 만료된 것 같습니다. 홈 화면에서 '네이버 로그인'을 다시 눌러 로그인해주세요.",
        );
      }
      throw new Error(`에디터 프레임(mainFrame)을 찾지 못했습니다. (현재 페이지: ${page.url()})`);
    }

    await dismissResumeDraftPopup(mainFrame, log);
    await closeFloatingPanels(mainFrame);

    log("제목을 입력하는 중...");
    await mainFrame.locator(SELECTORS.titleParagraph).click();
    await typeHuman(page, post.title);
    await page.keyboard.press("Enter");
    await sleep(300);

    log(`글자 크기를 ${DEFAULT_FONT_SIZE}로 조정하는 중...`);
    await setFontSize(mainFrame, DEFAULT_FONT_SIZE);

    const freeImageCtx: FreeImageCtx = { ready: false, searchTerm: deriveImageSearchTerm(post), insertCount: 0 };

    log(`본문을 작성하는 중... (총 ${post.blocks.length}개 블록)`);
    for (let i = 0; i < post.blocks.length; i++) {
      await fillBlock(mainFrame, page, post.blocks[i]!, profile, log, freeImageCtx);
      if ((i + 1) % 10 === 0) log(`${i + 1}/${post.blocks.length}개 블록 완료`);
    }

    log("마무리 정리 중 (열려있는 패널 닫기)...");
    await page.keyboard.press("Escape");
    await closeFloatingPanels(mainFrame);

    markPostFilledAwaitingPublish(postId);
    log(
      "자동입력이 끝났습니다. 이 창에서 내용을 확인하고, 자유롭게 더 수정한 뒤 직접 발행해주세요 " +
        "(발행 버튼은 이 프로그램이 절대 누르지 않습니다).",
      "done",
    );
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`오류가 발생했습니다: ${message}. 창은 열어두었으니 직접 이어서 작업하거나 진단해주세요.`, "error");
    markPostFailed(postId, `자동입력 실패: ${message}`);
    return { ok: false, error: message };
  }
}

async function dismissResumeDraftPopup(mainFrame: Frame, log: LogFn): Promise<void> {
  const popup = mainFrame.locator(SELECTORS.resumeDraftPopup);
  if (await popup.count().catch(() => 0)) {
    log("이어쓰기 팝업을 닫는 중...");
    await popup
      .getByText("취소", { exact: true })
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});
    await sleep(800);
  }
}

/** Naver occasionally opens a floating "글감 검색"/라이브러리 panel that can
 * obscure the screen — defensive cleanup at the end of the run. */
async function closeFloatingPanels(mainFrame: Frame): Promise<void> {
  const helpClose = mainFrame.locator(SELECTORS.helpPanelClose);
  if (await helpClose.count().catch(() => 0)) {
    await helpClose.click({ timeout: 3000 }).catch(() => {});
  }
}

async function setFontSize(mainFrame: Frame, px: number): Promise<void> {
  await mainFrame.locator(SELECTORS.fontSizeButton).click();
  await sleep(250);
  await mainFrame.locator(SELECTORS.fontSizeOption(px)).click();
  await sleep(250);
}

async function setTextFormat(mainFrame: Frame, value: "text" | "sectionTitle"): Promise<void> {
  await mainFrame.locator(SELECTORS.textFormatButton).click();
  await sleep(250);
  await mainFrame.locator(SELECTORS.textFormatOption(value)).click();
  await sleep(250);
}

/**
 * The trickiest part: toggling the background-color (형광펜) panel on/off.
 * Verifies the actual DOM state via the indicator element's class (rather
 * than trusting the click happened) and retries up to 3x — a timing race on
 * the "off" click was the most common failure mode observed, and an
 * un-verified failure silently bleeds color into everything typed after.
 */
async function setHighlight(mainFrame: Frame, on: boolean, log: LogFn): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await mainFrame.page().keyboard.press("Escape"); // normalize: close any already-open panel
    await sleep(150);
    await mainFrame.locator(SELECTORS.backgroundColorButton).click();
    await sleep(300);

    // .first() as a belt-and-suspenders on top of the :visible selector
    // (see selectors.ts) in case more than one match is still ever visible.
    if (on) {
      await mainFrame.locator(SELECTORS.colorSwatch(HIGHLIGHT_COLOR_HEX)).first().click();
    } else {
      await mainFrame.locator(SELECTORS.colorSwatchNone).first().click();
    }
    await sleep(300);

    const isWhite = await mainFrame
      .locator(SELECTORS.backgroundColorIndicator)
      .evaluate((el) => el.classList.contains("se-is-white-color"))
      .catch(() => null);

    const success = on ? isWhite === false : isWhite === true;
    if (success) return;

    log(`형광펜 ${on ? "켜기" : "끄기"} 확인 실패 — 재시도 ${attempt}/3`, "warn");
  }
  log(`형광펜 ${on ? "켜기" : "끄기"}를 3번 시도했지만 확인하지 못했습니다. 직접 확인해주세요.`, "warn");
}

/** Types a paragraph/heading's text, toggling bold/underline/highlight
 * on and off around each markup run rather than typing then selecting —
 * matches how a human would actually type with formatting. */
async function typeRichText(mainFrame: Frame, page: Page, text: string, log: LogFn): Promise<void> {
  const runs = parseInlineMarkup(text);
  let boldOn = false;
  let underlineOn = false;
  let highlightOn = false;

  for (const run of runs) {
    if (run.bold !== boldOn) {
      await mainFrame.locator(SELECTORS.boldButton).click();
      boldOn = run.bold;
    }
    if (run.underline !== underlineOn) {
      await mainFrame.locator(SELECTORS.underlineButton).click();
      underlineOn = run.underline;
    }
    if (run.highlight !== highlightOn) {
      await setHighlight(mainFrame, run.highlight, log);
      highlightOn = run.highlight;
    }
    await typeHuman(page, run.text);
  }

  // Always leave formatting off before moving to the next block.
  if (boldOn) await mainFrame.locator(SELECTORS.boldButton).click();
  if (underlineOn) await mainFrame.locator(SELECTORS.underlineButton).click();
  if (highlightOn) await setHighlight(mainFrame, false, log);
}

async function insertMedia(
  mainFrame: Frame,
  page: Page,
  buttonSelector: string,
  absoluteFilePath: string,
  waitMs: number,
): Promise<void> {
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
  await mainFrame.locator(buttonSelector).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(absoluteFilePath);
  await sleep(waitMs);
}

/**
 * Naver's sticker panel has no search box (verified live) — just a
 * category grid — so this picks a tile from whatever category is open by
 * default rather than semantically matching imageQuery. Panel stays open
 * after insertion; closeFloatingPanels() at the end of the run sweeps it.
 */
/** Per-post state threaded through fillBlock() so every free-image insert
 * in the same post reuses one already-configured (이미지 category, 무료-only
 * license filter) search panel instead of reopening/reconfiguring it each
 * time, and cycles through different results instead of the exact same
 * photo three times. */
interface FreeImageCtx {
  ready: boolean;
  searchTerm: string;
  insertCount: number;
}

function deriveImageSearchTerm(post: { keyword: string; title: string }): string {
  // A single broad word gets a much bigger result pool than a multi-word
  // phrase (observed live: "피아노 학원" returned only 2 results, both
  // 유료; "피아노" alone returns dozens) — more results means the
  // paid-photo retry loop in insertFreeImage() is far less likely to run
  // out of attempts.
  const firstWord = (post.keyword.trim() || post.title.trim()).split(/\s+/)[0];
  return firstWord || "피아노";
}

/**
 * Opens the "글감" materials-search panel, switches it to the "이미지"
 * category, and restricts results to 무료(free)-licensed only (Naver's
 * built-in OGQ stock photo marketplace — verified live via
 * scripts/inspect-editor.mjs on 2026-08-14). Idempotent per post via
 * FreeImageCtx.ready.
 */
async function setupFreeImageSearch(mainFrame: Frame, log: LogFn): Promise<void> {
  await mainFrame.locator(SELECTORS.materialsSearchToolbarButton).click();
  await sleep(1000);

  const categoryDropdown = mainFrame.locator(SELECTORS.materialsCategoryDropdown).first();
  if (await categoryDropdown.count().catch(() => 0)) {
    await categoryDropdown.click();
    await sleep(500);
    const imageOption = mainFrame.locator(SELECTORS.materialsImageCategoryOption).first();
    if (await imageOption.count().catch(() => 0)) {
      await imageOption.click();
      await sleep(500);
    }
  }

  const licenseToggle = mainFrame.locator(SELECTORS.materialsLicenseFilterToggle).first();
  if (await licenseToggle.count().catch(() => 0)) {
    await licenseToggle.click();
    await sleep(400);
    const checkboxes = mainFrame.locator(SELECTORS.materialsLicenseCheckbox);
    const total = await checkboxes.count();
    for (let i = 0; i < total; i++) {
      const cb = checkboxes.nth(i);
      const labelText = await cb
        .evaluate((el) => el.closest("label")?.textContent?.trim() ?? el.parentElement?.textContent?.trim())
        .catch(() => "");
      const checked = await cb.isChecked().catch(() => null);
      if (labelText === "유료" && checked) await cb.click({ force: true }).catch(() => {});
      if (labelText === "무료" && !checked) await cb.click({ force: true }).catch(() => {});
    }
    await licenseToggle.click().catch(() => {}); // close the filter dropdown
    await sleep(300);
  }
  log("무료 이미지 검색 패널을 준비했습니다.");
}

/** Searches Naver's free-image materials panel and inserts a result at the
 * cursor. Naver auto-adds a "© 촬영자, 출처 OGQ" attribution caption below
 * the image, satisfying the license's usage terms automatically. Failures
 * are swallowed (logged as a warning) so one bad search doesn't abort the
 * whole autofill run — the user can always add a photo manually. */
async function insertFreeImage(mainFrame: Frame, ctx: FreeImageCtx, log: LogFn): Promise<void> {
  try {
    if (!ctx.ready) {
      await setupFreeImageSearch(mainFrame, log);
      ctx.ready = true;
    }

    const input = mainFrame.locator(SELECTORS.materialsSearchInput);
    await input.click();
    await input.fill("");
    await input.fill(ctx.searchTerm);
    await input.press("Enter");
    await sleep(2000);

    const thumbs = mainFrame.locator(SELECTORS.materialsPhotoThumbnail);
    const count = await thumbs.count();
    if (count === 0) {
      log(`무료 이미지 검색 결과가 없어 사진 삽입을 건너뜁니다: "${ctx.searchTerm}"`, "warn");
      return;
    }

    // The 무료 license filter (set up once in setupFreeImageSearch) should
    // mean every result here is free, but isn't airtight — clicking a
    // 유료(paid) thumbnail doesn't insert anything; instead it opens a
    // full-viewport "구매 상세" modal that never closes itself and blocks
    // every click after it (observed live). Detect that case, close it,
    // and just try the next result instead of getting the whole run stuck.
    const maxAttempts = Math.min(count, 5);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const index = (ctx.insertCount + attempt) % count;
      await thumbs.nth(index).click({ force: true });
      await sleep(1200);

      const detailPopup = mainFrame.locator(SELECTORS.materialsImageDetailPopup);
      if (await detailPopup.count().catch(() => 0)) {
        log(`유료 사진이라 삽입되지 않아 다른 사진으로 다시 시도합니다 (${attempt + 1}/${maxAttempts}).`, "warn");
        await detailPopup
          .locator(SELECTORS.materialsImageDetailCloseButton)
          .click({ timeout: 3000 })
          .catch(() => {});
        await sleep(400);
        continue;
      }

      ctx.insertCount++;
      log(`무료 이미지를 자동으로 삽입했습니다 (검색어: "${ctx.searchTerm}", 출처는 자동 표기됩니다).`);
      return;
    }

    log(`무료로 바로 삽입 가능한 사진을 찾지 못해 이 사진 자리는 건너뜁니다: "${ctx.searchTerm}"`, "warn");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`무료 이미지 삽입에 실패해 이 사진 자리는 건너뜁니다: ${message}`, "warn");
  } finally {
    // The 글감 search panel keeps a transparent full-viewport dim layer
    // behind it while open — it visually looks like a small docked panel,
    // but that dim layer intercepts EVERY click outside it, including the
    // property toolbar's bold/underline buttons for whatever block comes
    // next (observed live: silently broke every block after the first
    // image insert until the whole run timed out). Always close the panel
    // again before handing control back, and re-open+reconfigure fresh
    // next time — a few hundred ms of overhead per photo is cheap insurance.
    await mainFrame.locator(SELECTORS.materialsSearchToolbarButton).click({ timeout: 3000 }).catch(() => {});
    await sleep(500);
    ctx.ready = false;
  }
}

async function insertSticker(mainFrame: Frame, log: LogFn): Promise<void> {
  // The toolbar button is a TOGGLE — if the panel is already open from a
  // previous emoticon block, clicking it again closes it instead of
  // re-opening it. Check whether tiles are already visible before deciding.
  const tiles = mainFrame.locator(SELECTORS.stickerTile);
  if ((await tiles.count().catch(() => 0)) === 0) {
    await mainFrame.locator(SELECTORS.stickerToolbarButton).click();
    await sleep(1000);
  }

  const count = await tiles.count();
  if (count === 0) {
    log("이모티콘 목록을 불러오지 못해 건너뜁니다.", "warn");
    await mainFrame.page().keyboard.press("Escape");
    return;
  }
  await tiles.nth(Math.floor(Math.random() * count)).click();
  await sleep(1200);
}

async function fillBlock(
  mainFrame: Frame,
  page: Page,
  block: Block,
  profile: BusinessProfileRecord,
  log: LogFn,
  freeImageCtx: FreeImageCtx,
): Promise<void> {
  switch (block.type) {
    case "paragraph":
      await typeRichText(mainFrame, page, block.text, log);
      await page.keyboard.press("Enter");
      break;

    case "heading":
      await setTextFormat(mainFrame, "sectionTitle");
      await typeRichText(mainFrame, page, block.text, log);
      await page.keyboard.press("Enter");
      await setTextFormat(mainFrame, "text"); // don't let the next paragraph inherit heading style
      break;

    case "divider":
      await mainFrame.locator(SELECTORS.dividerToolbarButton).click();
      await sleep(500);
      break;

    case "image_placeholder":
      if (block.filePath) {
        await insertMedia(mainFrame, page, SELECTORS.imageToolbarButton, path.join(UPLOADS_DIR, block.filePath), 1500);
      } else {
        // No manually uploaded photo — automatically pull a free-licensed
        // photo from Naver's own 글감 search instead of skipping.
        await insertFreeImage(mainFrame, freeImageCtx, log);
      }
      break;

    case "video_placeholder":
      if (block.filePath) {
        await insertMedia(mainFrame, page, SELECTORS.videoToolbarButton, path.join(UPLOADS_DIR, block.filePath), 5000);
      } else {
        log(`영상 자리에 업로드된 파일이 없어 건너뜁니다: ${block.imageQuery}`, "warn");
      }
      break;

    case "emoticon_placeholder":
      await insertSticker(mainFrame, log);
      break;

    case "link_block": {
      // Safety net: force-disable highlight immediately before any fixed
      // template block, in case a prior toggle silently failed.
      await setHighlight(mainFrame, false, log);

      if (block.kind === "reservation") {
        const widgetInserted = await insertPlaceWidget(mainFrame, page, profile.name, profile.address, log);
        // The widget already shows the address + a map. Pasting the raw
        // URL as plain text afterward makes Naver auto-expand it into a
        // second big preview card repeating that same address right below
        // it — a real redundant/ugly duplicate observed on a live published
        // post. Only fall back to the plain-text link when the widget
        // itself failed, so there's still SOME way to reserve.
        if (!widgetInserted) {
          await typeHuman(page, `${block.label} ${block.url}`);
          await page.keyboard.press("Enter");
        }
        break;
      }

      await typeHuman(page, `${block.label} ${block.url}`);
      await page.keyboard.press("Enter");
      break;
    }

    case "hashtags":
      await setHighlight(mainFrame, false, log);
      await typeHuman(page, block.tags.join(" "));
      break;
  }
}
