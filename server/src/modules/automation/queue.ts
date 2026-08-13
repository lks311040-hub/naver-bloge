import PQueue from "p-queue";

/**
 * Every Playwright-touching operation (login, editor autofill, ad-hoc
 * DOM-inspection sessions) goes through this single queue so nothing runs
 * concurrently — the browser is a single shared, human-visible resource.
 */
export const automationQueue: PQueue = new PQueue({ concurrency: 1 });
