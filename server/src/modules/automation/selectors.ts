/**
 * Naver Smart Editor ONE selectors, captured by live-session DOM inspection
 * (see scripts/inspect-editor.mjs) against the write page at
 * https://blog.naver.com/{blogId}?Redirect=Write on 2026-08-09.
 *
 * Naver changes this UI periodically — when a selector here stops working,
 * re-run scripts/inspect-editor.mjs against a real logged-in session to see
 * the current live DOM and update the values below. This is expected
 * ongoing maintenance, not a one-time task.
 *
 * Prefer stable `data-name`/`data-group`/`data-value` attributes over class
 * names, which churn more (`se-*` classes are mostly stable too, but the
 * data-* attributes are the more deliberate public contract).
 */
export const SELECTORS = {
  resumeDraftPopup: ".se-popup-alert-confirm",
  helpPanelClose: ".se-help-panel-close-button",

  titleParagraph: ".se-title-text .se-text-paragraph",
  bodyLastParagraph: ".se-component.se-text .se-text-paragraph",

  textFormatButton: '[data-name="text-format"][data-group="propertyToolbar"]',
  textFormatOption: (value: "text" | "sectionTitle" | "quotation") =>
    `[data-name="text-format"][data-group="propertyToolbar"][data-value="${value}"]`,

  fontSizeButton: '[data-name="font-size"][data-group="propertyToolbar"]',
  fontSizeOption: (px: number) => `[data-name="font-size"][data-group="propertyToolbar"][data-value="fs${px}"]`,

  boldButton: '[data-name="bold"][data-group="propertyToolbar"]',
  underlineButton: '[data-name="underline"][data-group="propertyToolbar"]',

  backgroundColorButton: '[data-name="background-color"][data-group="propertyToolbar"]',
  // The indicator swap is what M7's highlight-off verification reads.
  backgroundColorIndicator: '[data-name="background-color"][data-group="propertyToolbar"] .se-background-color-indicator',
  // :visible — Naver appears to keep stale/hidden copies of the color
  // panel in the DOM from previous opens rather than removing them, so more
  // than one swatch with the same data-color can match; only one is ever
  // actually shown at a time.
  colorSwatch: (hex: string) => `button.se-color-palette[data-color="${hex}"]:visible`,
  colorSwatchNone: "button.se-color-palette-no-color:visible",

  imageToolbarButton: '[data-name="image"][data-group="documentToolbar"]',
  videoToolbarButton: '[data-name="video"][data-group="documentToolbar"]',
  stickerToolbarButton: '[data-name="sticker"][data-group="documentToolbar"]',

  // Sticker sidebar panel — no search UI exists (verified live); it's a
  // category grid only, so autofill just picks a tile from the open
  // (default/recent) category rather than matching imageQuery.
  stickerTile: ".se-sidebar-element-sticker",

  // The "default style" divider — one direct click, no style sub-menu.
  dividerToolbarButton:
    '[data-name="horizontal-line"][data-group="documentToolbar"].se-insert-horizontal-line-default-toolbar-button',

  // Never used to click — kept only so a future defensive assertion
  // ("we never queried this selector for a click") has something to grep for.
  publishButton: ".publish_btn__m9KHH",
} as const;

/** Light yellow — matches the "노란 형광펜" requirement. */
export const HIGHLIGHT_COLOR_HEX = "#fff8b2";
export const DEFAULT_FONT_SIZE = 16;
