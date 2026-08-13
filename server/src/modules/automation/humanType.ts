import type { Page } from "playwright";

export interface TypeOptions {
  baseDelayMs?: number;
  jitterMs?: number;
  longPauseProbability?: number;
  longPauseMs?: number;
}

const DEFAULTS: Required<TypeOptions> = {
  baseDelayMs: 35,
  jitterMs: 40,
  longPauseProbability: 0.03,
  longPauseMs: 350,
};

/** Types character-by-character with randomized delay + occasional longer
 * pauses, so it doesn't look like a script pasting text in instantly. */
export async function typeHuman(page: Page, text: string, opts: TypeOptions = {}): Promise<void> {
  const { baseDelayMs, jitterMs, longPauseProbability, longPauseMs } = { ...DEFAULTS, ...opts };
  for (const ch of text) {
    await page.keyboard.type(ch);
    let delay = baseDelayMs + Math.random() * jitterMs;
    if (Math.random() < longPauseProbability) delay += longPauseMs;
    await sleep(delay);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
