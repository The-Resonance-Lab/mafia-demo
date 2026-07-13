/**
 * Local sandbox — plays a full game against script bots without touching a
 * live MafiaStudio table. Use this to regression-test the persona before you
 * mint a seat token.
 *
 * Needs OPENROUTER_API_KEY + DATABASE_URL. No MAFIA_STUDIO_KEY, no SEAT_TOKEN.
 */
import "dotenv/config";
import { createAgentInstance } from "emocentric/postgres";
import { OpenRouterClient } from "emocentric/openrouter";
import { sandboxTable } from "mafia-studio-adapter";
import { blueprint } from "./blueprint.js";

async function main(): Promise<void> {
  for (const name of ["OPENROUTER_API_KEY", "DATABASE_URL"]) {
    if (!process.env[name]) {
      console.error(`missing env: ${name}`);
      process.exit(1);
    }
  }

  const { agent } = await createAgentInstance({
    blueprint,
    userId: "sandbox-seat",
    llm: new OpenRouterClient({
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: "anthropic/claude-sonnet-4.6",
    }),
  });

  console.log(`[sandbox] running ${blueprint.id} as town…`);
  const summary = await sandboxTable({
    agent,
    agentRole: "town",
    logTelemetry: true,
  });

  console.log("\n[sandbox summary]");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
