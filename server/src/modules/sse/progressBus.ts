import { EventEmitter } from "node:events";

export type ProgressLevel = "info" | "warn" | "error" | "done";

export interface ProgressEvent {
  runId: string;
  message: string;
  level: ProgressLevel;
  timestamp: string;
}

/**
 * Process-wide progress bus. Each automation run (Naver login, editor
 * autofill, ...) publishes to its own `runId` channel; the SSE route
 * subscribes a single client to exactly that channel.
 */
class ProgressBus extends EventEmitter {
  publish(runId: string, message: string, level: ProgressLevel = "info"): void {
    const event: ProgressEvent = { runId, message, level, timestamp: new Date().toISOString() };
    this.emit(runId, event);
  }
}

export const progressBus = new ProgressBus();
// Many SSE subscribers (browser tabs) + many automation runs can coexist —
// raise the default limit rather than let Node warn about "possible memory leak".
progressBus.setMaxListeners(100);
