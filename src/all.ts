/**
 * Spawns all four personas in parallel, each in its own child process.
 *
 * `npm run all`
 *
 * Reads a shared .env for MAFIA_STUDIO_KEY / MAFIA_STUDIO_WS / OPENROUTER /
 * DATABASE_URL and per-persona SEAT_TOKEN_VERA / _MARCUS / _SOFIA / _THEO.
 *
 * Each child logs with its own [Name] tag. Ctrl-C shuts them all down cleanly.
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BLUEPRINTS, type PersonaName } from "./blueprints/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const agentEntry = resolve(here, "agent.ts");
const allPersonas = Object.keys(BLUEPRINTS) as PersonaName[];

// Only spawn personas that HAVE a seat token for this table. Everyone else is
// skipped with a note — makes it possible to run a subset when a table only
// seats some of the registered personas.
const personas = allPersonas.filter(
  (p) => !!process.env[`SEAT_TOKEN_${p.toUpperCase()}`],
);
const skipped = allPersonas.filter((p) => !personas.includes(p));
for (const p of skipped) {
  console.log(`[all] skip ${p} · no SEAT_TOKEN_${p.toUpperCase()} in .env`);
}
if (personas.length === 0) {
  console.error("no personas have seat tokens; run `npm run bootstrap` first");
  process.exit(1);
}

const children: ChildProcess[] = [];

/** Stagger spawn by this many ms per child. Realtime auth can race under a
 *  4-parallel connect burst (occasional 4401 close on the slowest to arrive);
 *  a small delay serializes the handshakes and eliminates it. */
const SPAWN_STAGGER_MS = 5000;

async function spawnAll() {
  for (const p of personas) {
    const child = spawn(process.execPath, [
      "--import", "tsx",
      agentEntry,
    ], {
      env: { ...process.env, PERSONA: p },
      stdio: "inherit",
    });
    children.push(child);
    child.on("exit", (code) => {
      console.log(`[all] ${p} exited with ${code}`);
      // If every child has died, let the parent exit too — no zombies.
      if (children.every((c) => c.exitCode !== null || c.killed)) {
        process.exit(0);
      }
    });
    await new Promise((r) => setTimeout(r, SPAWN_STAGGER_MS));
  }
  console.log(`[all] spawned ${children.length} agents · Ctrl-C to stop`);
}

// Keep the event loop alive after spawnAll resolves. Without this, the parent
// exits on Windows the moment its `spawnAll` promise settles and the children
// are dropped with it. `process.stdin.resume()` refs stdin, which keeps the
// loop pinned until stdin is closed or the process is killed.
process.stdin.resume();

void spawnAll();

const shutdown = () => {
  console.log("[all] shutting down…");
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
  setTimeout(() => process.exit(0), 2000);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
