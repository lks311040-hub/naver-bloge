import type { Frame, Page } from "playwright";
import type { ProgressLevel } from "../sse/index.js";
import { SELECTORS } from "./selectors.js";
import { sleep } from "./humanType.js";

type LogFn = (message: string, level?: ProgressLevel) => void;

/**
 * Same business name can have branches nationwide (verified live: searching
 * a real academy name surfaced 7 unrelated branches across the country) —
 * score each candidate by how many whitespace-split tokens of the
 * registered address it contains, weighting numeric tokens (street number)
 * higher since those are what actually disambiguate branches sharing a name.
 */
function scoreAddressMatch(candidateAddress: string, targetTokens: string[]): number {
  let score = 0;
  for (const token of targetTokens) {
    if (!token) continue;
    if (candidateAddress.includes(token)) {
      score += /\d/.test(token) ? 3 : 1;
    }
  }
  return score;
}

/**
 * Inserts a real Naver "장소" (Place) map widget — required for Place
 * linkage, not just a text link. Returns false (with a logged reason) if it
 * couldn't find/select a candidate, so the caller can fall back to a plain
 * text link only.
 */
export async function insertPlaceWidget(
  mainFrame: Frame,
  page: Page,
  businessName: string,
  address: string,
  log: LogFn,
): Promise<boolean> {
  if (!businessName.trim() || !address.trim()) {
    log("업체명 또는 주소가 등록되어 있지 않아 장소 위젯 삽입을 건너뜁니다.", "warn");
    return false;
  }

  log("장소 위젯을 검색하는 중...");
  await mainFrame.locator(SELECTORS.mapToolbarButton).click();
  await sleep(1000);

  const placePopup = mainFrame.locator(SELECTORS.placePopup).first();
  const searchInput = placePopup.locator(SELECTORS.placeSearchInput).first();
  await searchInput.click();
  await searchInput.fill(businessName);
  await page.keyboard.press("Enter");
  await sleep(2000);

  const items = await placePopup.locator(SELECTORS.placeResultItem).all();
  if (items.length === 0) {
    log(`"${businessName}" 검색 결과가 없어 장소 위젯 삽입을 건너뜁니다.`, "warn");
    await page.keyboard.press("Escape");
    return false;
  }

  const targetTokens = address.split(/\s+/);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < items.length; i++) {
    const addrText = (await items[i]!.locator(SELECTORS.placeResultAddress).textContent().catch(() => "")) ?? "";
    const s = scoreAddressMatch(addrText, targetTokens);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  if (bestScore <= 0) {
    log("검색 결과 중 등록된 주소와 뚜렷이 일치하는 항목이 없어, 가장 가까운 후보를 사용합니다.", "warn");
  }

  const best = items[bestIdx]!;
  await best.hover();
  await sleep(300);
  await best.locator(SELECTORS.placeAddButton).click();
  await sleep(800);

  // Scoped to placePopup — a same-class "확인" button also exists outside
  // this popup elsewhere on the page, and a global click could hit that one.
  await placePopup.locator(SELECTORS.placeConfirmButton).click();
  await sleep(800);

  log("장소 위젯을 삽입했습니다.");
  return true;
}
