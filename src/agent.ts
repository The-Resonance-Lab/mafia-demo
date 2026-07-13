/**
 * mafia-demo — a reference end-to-end MafiaStudio agent.
 *
 * Reads MAFIA_STUDIO_KEY + SEAT_TOKEN + MAFIA_STUDIO_WS from env, spins up an
 * emocentric instance backed by OpenRouter + Postgres, and hands it to the
 * adapter's connectToTable. From that moment on, the SDK's heartbeat drives
 * every decision — you don't write turn logic here.
 */
import "dotenv/config";
import { createAgentInstance } from "emocentric/postgres";
import { OpenRouterClient } from "emocentric/openrouter";
import {
  connectToTable,
  MAFIA_ACTIONS,
} from "mafia-studio-adapter";
import type {
  PhaseChangeData,
  RoomWelcomeData,
  SeatRole,
} from "mafia-studio-protocol";
import { blueprint } from "./blueprint.js";

function require_env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  // Verify env up front so we don't get a stack trace deep inside pg / openrouter.
  for (const name of [
    "MAFIA_STUDIO_KEY",
    "SEAT_TOKEN",
    "MAFIA_STUDIO_WS",
    "OPENROUTER_API_KEY",
    "DATABASE_URL",
  ]) {
    require_env(name);
  }

  // Spin the agent instance. userId = "seat" keeps state per-seat: if the
  // process reconnects mid-game, Vera picks up her feelings and memory intact.
  const { agent, close: closeAgent } = await createAgentInstance({
    blueprint,
    userId: "seat",
    llm: new OpenRouterClient({
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: "anthropic/claude-sonnet-4.6",
    }),
    // DATABASE_URL is read from env by the postgres adapter.
  });

  console.log(`[boot] blueprint ${blueprint.id} v${blueprint.version ?? 1} ready`);

  // Track role locally so shutdown logs are clearer. All strategy runs through
  // the agent's pipeline — this is just for observability.
  let myRole: SeatRole | null = null;
  let currentPhase = "LOBBY";
  let round = 0;

  const conn = await connectToTable({
    apiKey: process.env.MAFIA_STUDIO_KEY!,
    seatToken: process.env.SEAT_TOKEN!,
    endpoint: process.env.MAFIA_STUDIO_WS!,
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
            `[welcome] seat ${w.seat_label} · role ${myRole} · ${w.table.seats.length} seats` +
              (allies.length ? ` · mafia allies: ${allies.join(", ")}` : ""),
          );
          return;
        }
        case "phase.change": {
          const d = evt.data as PhaseChangeData & { round?: number };
          currentPhase = d.to;
          if (typeof d.round === "number") round = d.round;
          console.log(`[phase] r${round} → ${currentPhase}`);
          return;
        }
        case "game.over": {
          console.log(`[game over]`, evt.data);
          return;
        }
        // The SDK handles the rest — room.message goes into short-term memory,
        // move.result feeds the appraiser, agent.telemetry is what the monitor
        // renders. No need to intercept.
        default:
          return;
      }
    },

    onFatal: async (err) => {
      console.error("[fatal]", err);
      await conn.close().catch(() => {});
      await closeAgent?.().catch(() => {});
      process.exit(1);
    },
  });

  console.log(
    `[connected] seat ${conn.seatId} at table ${conn.tableId} (phase ${currentPhase})`,
  );

  const shutdown = async (why: string) => {
    console.log(`[shutdown] ${why} · was ${myRole ?? "unknown"} in ${currentPhase}`);
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
