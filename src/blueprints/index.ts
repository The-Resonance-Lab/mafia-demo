import type { AgentBlueprint } from "emocentric";
import { sana } from "./sana.js";
import { kai } from "./kai.js";
import { nadya } from "./nadya.js";
import { elie } from "./elie.js";
import { vera } from "./vera.js";
import { marcus } from "./marcus.js";
import { sofia } from "./sofia.js";
import { theo } from "./theo.js";

/**
 * Eight hand-drawn personas. The four "voiced" set (sana, kai, nadya, elie) is
 * the primary demo; the archetype set (vera, marcus, sofia, theo) is kept here
 * so cross-team tables can seat any registered persona under a real blueprint.
 */
export const BLUEPRINTS = { sana, kai, nadya, elie, vera, marcus, sofia, theo } as const;
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

export { sana, kai, nadya, elie, vera, marcus, sofia, theo };
