/**
 * mafia-demo — one persona, connected to a live MafiaStudio table.
 *
 * PERSONA=vera npm start
 *   → picks src/blueprints/vera.ts
 *   → reads SEAT_TOKEN_VERA (or SEAT_TOKEN if not set)
 *
 * Uses adapter Path B (blueprint + llm + overrides). The adapter composes
 * the Agent internally with Mafia-tuned defaults — MafiaAwareInterpreter,
 * AntiCascadeAppraiser, ForceVoteProcessor, MafiaMemoryFormat — so personas
 * get better game-aware reasoning for free.
 */
import "dotenv/config";
import { OpenRouterClient } from "emocentric/openrouter";
import type { ActionExecutor } from "emocentric";
import {
  connectToTable,
  MAFIA_ACTIONS,
  MAFIA_ACTION_BLUEPRINTS,
} from "mafia-studio-adapter";
import type {
  PhaseChangeData,
  RoomWelcomeData,
  SeatRole,
} from "mafia-studio-protocol";
import { getBlueprint } from "./blueprints/index.js";
import { MAFIA_STUDIO_WS } from "./config.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

function resolveSeatToken(personaName: string): string {
  const key = `SEAT_TOKEN_${personaName.toUpperCase()}`;
  const specific = process.env[key];
  if (specific) return specific;
  const generic = process.env.SEAT_TOKEN;
  if (generic) return generic;
  console.error(`missing env: ${key} (or SEAT_TOKEN)`);
  process.exit(1);
}

// MafiaStudio's realtime server enacts every chosen action itself; the
// persona-side executors are no-ops (they only exist because the SDK's
// compileActions requires one per declared action). You could hook them for
// local logging or metrics if you wanted to.
const noopExecutors: Record<string, ActionExecutor> = Object.fromEntries(
  MAFIA_ACTION_BLUEPRINTS.map((a) => [a.name, async () => undefined]),
);

async function main(): Promise<void> {
  const personaName = process.env.PERSONA ?? "sana";
  const blueprint = getBlueprint(personaName);

  requireEnv("MAFIA_STUDIO_KEY");
  requireEnv("OPENROUTER_API_KEY");
  const seatToken = resolveSeatToken(personaName);

  const tag = `[${blueprint.persona.name}]`;
  console.log(`${tag} boot · blueprint ${blueprint.id} v${blueprint.version ?? 1}`);

  let myRole: SeatRole | null = null;
  let currentPhase = "LOBBY";
  let round = 0;
  // Populated once connectToTable resolves. Kept in outer scope so onFatal /
  // shutdown handlers can close it, but referenced only when non-null (onFatal
  // fires from an early WebSocket close BEFORE this assignment completes).
  let conn: Awaited<ReturnType<typeof connectToTable>> | null = null;

  conn = await connectToTable({
    apiKey: process.env.MAFIA_STUDIO_KEY!,
    seatToken,
    endpoint: MAFIA_STUDIO_WS,
    blueprint,
    llm: new OpenRouterClient({
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: process.env.MODEL ?? "anthropic/claude-sonnet-4.6",
    }),
    executors: noopExecutors,
    actions: [...MAFIA_ACTIONS],

    onGameEvent: (evt) => {
      switch (evt.type) {
        case "room.welcome": {
          const w = evt.data as RoomWelcomeData;
          myRole = w.seat_role;
          const allies = Object.entries(w.visible_roles ?? {})
            .filter(([, r]) => r === "mafia")
            .map(([id]) => id);
          console.log(
            `${tag} welcome · seat ${w.seat_label} · role ${myRole} · ${w.table.seats.length} seats` +
              (allies.length ? ` · mafia allies: ${allies.join(", ")}` : ""),
          );
          return;
        }
        case "phase.change": {
          const d = evt.data as PhaseChangeData & { round?: number };
          currentPhase = d.to;
          if (typeof d.round === "number") round = d.round;
          console.log(`${tag} r${round} → ${currentPhase}`);
          return;
        }
        case "game.over": {
          console.log(`${tag} game over ·`, evt.data);
          return;
        }
        default:
          return;
      }
    },

    onFatal: (err) => {
      console.error(`${tag} fatal ·`, err);
      void conn?.close().catch(() => {});
      process.exit(1);
    },
  });

  console.log(
    `${tag} connected · seat ${conn.seatId} · table ${conn.tableId} · phase ${currentPhase}`,
  );

  const shutdown = async (why: string) => {
    console.log(`${tag} shutdown · ${why} · was ${myRole ?? "unknown"} in ${currentPhase}`);
    await conn?.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
