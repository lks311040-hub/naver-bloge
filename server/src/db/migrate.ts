import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDb } from "./connection.js";
import { MIGRATIONS_DIR } from "../config/paths.js";

/**
 * Applies every .sql file in db/migrations/, in filename order, exactly
 * once. Tracked in schema_migrations so re-running is a no-op. Called at
 * server boot before anything else touches the DB (see src/index.ts), and
 * can also be invoked directly via `npm run migrate -w server`.
 */
export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((row) => (row as { id: string }).id),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const markApplied = db.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, datetime('now'))",
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const runOne = db.transaction(() => {
      db.exec(sql);
      markApplied.run(file);
    });
    runOne();
    console.log(`[migrate] applied ${file}`);
  }
}

// Allow `tsx src/db/migrate.ts` to run migrations standalone.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  runMigrations();
  console.log("[migrate] done");
}
