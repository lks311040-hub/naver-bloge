import type { AiBodyBlock, AiBodyBlockList } from "./blocks.js";

/**
 * Inline markup tokens used in paragraph/heading text:
 *   **bold**, ==highlight==, __underline__
 * By convention (enforced in the AI prompt, not here) these never nest or
 * stack within a single run, but this parser tolerates arbitrary input —
 * it just won't apply more than one style to a given run since the source
 * markers themselves don't overlap.
 */
export interface MarkupRun {
  text: string;
  bold: boolean;
  highlight: boolean;
  underline: boolean;
}

const MARKUP_PATTERN = /\*\*(.+?)\*\*|==(.+?)==|__(.+?)__/g;

/**
 * Splits raw markup text into styled runs. Used identically by the React
 * block renderer (for a WYSIWYG-ish preview) and by the Playwright typer
 * (to know exactly when to toggle a formatting button on/off mid-paragraph).
 */
export function parseInlineMarkup(input: string): MarkupRun[] {
  const runs: MarkupRun[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MARKUP_PATTERN.lastIndex = 0;
  while ((match = MARKUP_PATTERN.exec(input)) !== null) {
    if (match.index > lastIndex) {
      runs.push({
        text: input.slice(lastIndex, match.index),
        bold: false,
        highlight: false,
        underline: false,
      });
    }
    if (match[1] !== undefined) {
      runs.push({ text: match[1], bold: true, highlight: false, underline: false });
    } else if (match[2] !== undefined) {
      runs.push({ text: match[2], bold: false, highlight: true, underline: false });
    } else if (match[3] !== undefined) {
      runs.push({ text: match[3], bold: false, highlight: false, underline: true });
    }
    lastIndex = MARKUP_PATTERN.lastIndex;
  }
  if (lastIndex < input.length) {
    runs.push({ text: input.slice(lastIndex), bold: false, highlight: false, underline: false });
  }
  return runs;
}

/** Removes markup delimiters, keeping only the visible inner text. */
export function stripInlineMarkup(input: string): string {
  return parseInlineMarkup(input)
    .map((run) => run.text)
    .join("");
}

/**
 * Visible (post-strip) character count across paragraph/heading blocks only.
 * This is the basis for the 2800~3200자 length target — markup delimiter
 * characters are not counted, since they are never actually typed/visible
 * in the published post (documented assumption, see plan §Context).
 */
export function countVisibleChars(blocks: AiBodyBlockList): number {
  let total = 0;
  for (const block of blocks) {
    if (block.type === "paragraph" || block.type === "heading") {
      total += stripInlineMarkup(block.text).length;
    }
  }
  return total;
}

/**
 * Counts occurrences of `keyword` across paragraph/heading text (after
 * stripping markup). Used by the AI self-check loop to verify the target
 * keyword appears exactly 4 times.
 */
export function countKeywordOccurrences(blocks: AiBodyBlockList, keyword: string): number {
  if (!keyword.trim()) return 0;
  let total = 0;
  for (const block of blocks) {
    if (block.type === "paragraph" || block.type === "heading") {
      const visible = stripInlineMarkup(block.text);
      total += visible.split(keyword).length - 1;
    }
  }
  return total;
}

export function countBlocksByType(
  blocks: AiBodyBlockList,
  type: AiBodyBlock["type"],
): number {
  return blocks.filter((b) => b.type === type).length;
}
