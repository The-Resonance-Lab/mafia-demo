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
const personas = Object.keys(BLUEPRINTS) as PersonaName[];

// Fail fast if any per-persona token is missing — better than watching one
// child crash on connect.
const missing: string[] = [];
for (const p of personas) {
  const key = `SEAT_TOKEN_${p.toUpperCase()}`;
  if (!process.env[key]) missing.push(key);
}
if (missing.length > 0) {
  console.error(`missing seat tokens: ${missing.join(", ")}`);
  console.error(`hint: run \`npm run bootstrap\` to mint them, or set them by hand`);
  process.exit(1);
}

const children: ChildProcess[] = [];

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
  });
}

console.log(`[all] spawned ${children.length} agents · Ctrl-C to stop`);

const shutdown = () => {
  console.log("[all] shutting down…");
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
  setTimeout(() => process.exit(0), 2000);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
