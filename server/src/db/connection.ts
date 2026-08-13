import Database from "better-sqlite3";
import { DB_PATH, ensureDataDirs } from "../config/paths.js";

let db: Database.Database | undefined;

/**
 * Returns the process-wide SQLite connection, opening it (WAL mode) on
 * first use. better-sqlite3 is synchronous, so a single shared connection
 * is safe to reuse across requests without a pool.
 */
export function getDb(): Database.Database {
  if (!db) {
    ensureDataDirs();
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}
