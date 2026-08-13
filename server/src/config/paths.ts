import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// server/src/config/paths.ts -> server/
const SERVER_ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

export const DATA_DIR = path.join(SERVER_ROOT, "data");
export const DB_PATH = path.join(DATA_DIR, "app.db");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const NAVER_STORAGE_STATE_PATH = path.join(DATA_DIR, "naver-storage-state.json");
export const MIGRATIONS_DIR = path.resolve(fileURLToPath(new URL("../db/migrations", import.meta.url)));

export function ensureDataDirs(): void {
  for (const dir of [DATA_DIR, UPLOADS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
