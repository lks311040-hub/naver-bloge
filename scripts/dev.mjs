#!/usr/bin/env node
/**
 * Custom dev orchestrator — spawns shared(tsc watch)/server(tsx watch)/web
 * (vite) as three sibling processes with stdio:'inherit'.
 *
 * Why not `concurrently`: on this Windows machine, concurrently's
 * pipe-capture-and-reprint of each child's stdout reliably deadlocked
 * specifically for the `tsx watch` child (shared/web always printed fine;
 * server's output never arrived and it never bound its port, even after
 * waiting minutes) — while running the exact same `npx tsx watch ...`
 * command directly, bypassing concurrently, always booted in ~1s. Piping
 * output straight through with stdio:'inherit' sidesteps whatever pipe
 * quirk that is, at the cost of unprefixed/interleaved log lines.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Spawn `node <entry.js>` directly (never npx/.cmd shims): on Windows,
// child_process.spawn() can't exec a .cmd file without shell:true, and
// shell:true reintroduces cmd.exe wrapping — resolving straight to each
// tool's real JS entry point sidesteps both.
const specs = [
  {
    name: "shared",
    args: [path.join("node_modules", "typescript", "bin", "tsc"), "-b", "shared", "--watch", "--preserveWatchOutput"],
  },
  {
    name: "server",
    args: [path.join("node_modules", "tsx", "dist", "cli.mjs"), "watch", "server/src/index.ts"],
  },
  {
    name: "web",
    args: [path.join("node_modules", "vite", "bin", "vite.js"), "--config", "web/vite.config.ts"],
  },
];

const children = [];

for (const spec of specs) {
  const child = spawn(process.execPath, spec.args, { cwd: ROOT, stdio: "inherit" });
  child.on("exit", (code) => {
    console.log(`\n[dev] "${spec.name}" exited (code ${code}) — stopping the others.\n`);
    for (const other of children) {
      if (other !== child) other.kill();
    }
    process.exitCode = code ?? 1;
  });
  children.push(child);
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const child of children) child.kill(sig);
  });
}
