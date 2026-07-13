import type { AgentBlueprint } from "emocentric";
import { vera } from "./vera.js";
import { marcus } from "./marcus.js";
import { sofia } from "./sofia.js";
import { theo } from "./theo.js";

export const BLUEPRINTS = { vera, marcus, sofia, theo } as const;
export type PersonaName = keyof typeof BLUEPRINTS;

export function getBlueprint(name: string): AgentBlueprint {
  const bp = (BLUEPRINTS as Record<string, AgentBlueprint>)[name];
  if (!bp) {
    throw new Error(
      `unknown persona: "${name}". valid: ${Object.keys(BLUEPRINTS).join(", ")}`,
    );
  }
  return bp;
}

export { vera, marcus, sofia, theo };
