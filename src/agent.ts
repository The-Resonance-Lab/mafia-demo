/**
 * mafia-demo — one persona, connected to a live MafiaStudio table.
 *
 * PERSONA=vera npm start
 *   → picks src/blueprints/vera.ts
 *   → reads SEAT_TOKEN_VERA (or SEAT_TOKEN if not set)
 *
 * The SDK's heartbeat drives every turn decision. This file only wires
 * credentials + logging.
 */
import "dotenv/config";
import { createAgentInstance } from "emocentric/postgres";
import { OpenRouterClient } from "emocentric/openrouter";
import { connectToTable, MAFIA_ACTIONS } from "mafia-studio-adapter";
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

/** Resolve the seat token for this persona: prefer SEAT_TOKEN_<PERSONA>, fall
 *  back to SEAT_TOKEN. Lets you either run one persona (single .env var) or
 *  four in parallel (per-persona vars). */
function resolveSeatToken(personaName: string): string {
  const key = `SEAT_TOKEN_${personaName.toUpperCase()}`;
  const specific = process.env[key];
  if (specific) return specific;
  const generic = process.env.SEAT_TOKEN;
  if (generic) return generic;
  console.error(`missing env: ${key} (or SEAT_TOKEN)`);
  process.exit(1);
}

async function main(): Promise<void> {
  const personaName = process.env.PERSONA ?? "vera";
  const blueprint = getBlueprint(personaName);

  requireEnv("MAFIA_STUDIO_KEY");
  requireEnv("OPENROUTER_API_KEY");
  requireEnv("DATABASE_URL");
  const seatToken = resolveSeatToken(personaName);

  const tag = `[${blueprint.persona.name}]`;
  console.log(`${tag} boot · blueprint ${blueprint.id} v${blueprint.version ?? 1}`);

  const { agent, close: closeAgent } = await createAgentInstance({
    blueprint,
    userId: `seat-${personaName}`,
    llm: new OpenRouterClient({
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: process.env.MODEL ?? "anthropic/claude-sonnet-4.6",
    }),
  });

  let myRole: SeatRole | null = null;
  let currentPhase = "LOBBY";
  let round = 0;

  const conn = await connectToTable({
    apiKey: process.env.MAFIA_STUDIO_KEY!,
    seatToken,
    endpoint: MAFIA_STUDIO_WS,
    agent,
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

    onFatal: async (err) => {
      console.error(`${tag} fatal ·`, err);
      await conn.close().catch(() => {});
      await closeAgent?.().catch(() => {});
      process.exit(1);
    },
  });

  console.log(
    `${tag} connected · seat ${conn.seatId} · table ${conn.tableId} · phase ${currentPhase}`,
  );

  const shutdown = async (why: string) => {
    console.log(`${tag} shutdown · ${why} · was ${myRole ?? "unknown"} in ${currentPhase}`);
    await conn.close().catch(() => {});
    await closeAgent?.().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
