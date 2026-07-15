import type { AgentBlueprint } from "emocentric";
import { sana } from "./sana.js";
import { kai } from "./kai.js";
import { nadya } from "./nadya.js";
import { elie } from "./elie.js";

/**
 * Four hand-drawn personas — not archetypes. Each has a distinct backstory, a
 * custom emotion added to (or filtered from) the SDK's default palette, and
 * seed facts tuned for that voice.
 *
 * Copy any of these to a new file to author your own; the shape is the entire
 * API surface. `emocentric`'s `AgentBlueprint` type is the single source of
 * truth for what's valid.
 */
export const BLUEPRINTS = { kai, sana, nadya, elie } as const;
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

export { sana, kai, nadya, elie };
