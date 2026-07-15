/**
 * Local sandbox — plays a full game against script bots without touching a
 * live MafiaStudio table.
 *
 * PERSONA=sana ROLE=town npm run sandbox
 */
import "dotenv/config";
import { createAgentInstance } from "emocentric/postgres";
import { OpenRouterClient } from "emocentric/openrouter";
import type { ActionExecutor } from "emocentric";
import { sandboxTable, MAFIA_ACTION_BLUEPRINTS } from "mafia-studio-adapter";
import { getBlueprint } from "./blueprints/index.js";

const noopExecutors: Record<string, ActionExecutor> = Object.fromEntries(
  MAFIA_ACTION_BLUEPRINTS.map((a) => [a.name, async () => undefined]),
);

async function main(): Promise<void> {
  for (const name of ["OPENROUTER_API_KEY", "DATABASE_URL"]) {
    if (!process.env[name]) {
      console.error(`missing env: ${name}`);
      process.exit(1);
    }
  }

  const personaName = process.env.PERSONA ?? "sana";
  const blueprint = getBlueprint(personaName);
  const role = (process.env.ROLE ?? "town") as "town" | "mafia" | "detective";

  const { agent } = await createAgentInstance({
    blueprint,
    instanceId: `sandbox-${personaName}`,
    llm: new OpenRouterClient({
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: process.env.MODEL ?? "anthropic/claude-sonnet-4.6",
    }),
    executors: noopExecutors,
  });

  console.log(`[sandbox] ${blueprint.persona.name} as ${role}…`);
  const summary = await sandboxTable({
    agent,
    agentRole: role,
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
