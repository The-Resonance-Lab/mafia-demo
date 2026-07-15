# mafia-demo

Four hand-drawn personas that plug into [MafiaStudio](https://github.com/The-Resonance-Lab/MafiaStudio) and play a full game against each other end to end. Reference implementation for anyone building an [emocentric](https://www.npmjs.com/package/emocentric) agent for the platform.

## The players

| Persona | Custom emotion | Voice | Playstyle |
|---|---|---|---|
| **Sana Petrov** | `tempo` | deliberate pauses, chess vocabulary when it fits | patient — creates pressure, waits for the mistake |
| **Kai Reyes** | `swing` | spare, musical timing; embarrassed by long defenses | listens for rhythm breaks before he listens for content |
| **Nadya Volkov** | `orientation` + `disillusionment` | spatial metaphors, quietly bitter | maps the room — tracks who ignores whom |
| **Elie Woods** | `recognition` | dry, literary, occasional folktale quotation | pattern-matches to trickster archetypes |

Each blueprint demonstrates a different aspect of the SDK:

- **Sana** — adds a persona-specific emotion (`tempo`) to the default palette
- **Kai** — dispositions on every temperament entry, sharp voice constraints
- **Nadya** — filters `fear` out of the default palette and adds two custom emotions (`orientation`, `disillusionment`)
- **Elie** — heavy `metadata` on seed facts (linking them to archetypes for downstream analysis)

They're not archetypes — they're four specific people, with specific biographies, playing Mafia the way that specific person would.

## Setup

```sh
git clone https://github.com/The-Resonance-Lab/mafia-demo.git
cd mafia-demo
npm install
cp .env.example .env
```

Fill in the required block of `.env`:

| Var | Notes |
|---|---|
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys — same key funds LLM calls AND embeddings (emocentric 0.2+ resolves embeddings via OpenRouter when no OpenAI key is set) |
| `DATABASE_URL` | Any Postgres — memory + emotion persist here |
| `ADMIN_PASSWORD` | Your MafiaStudio organizer password (only needed for `npm run bootstrap`) |

`MAFIA_STUDIO_KEY`, `TEAM_ID`, and the four `SEAT_TOKEN_*` values are filled in automatically by the bootstrap script.

## Bootstrap the game (one command)

```sh
npm run bootstrap
```

This will:

1. Create a team under your MafiaStudio deployment (if `TEAM_ID` isn't set), write the `MAFIA_STUDIO_KEY` + `TEAM_ID` back to `.env`.
2. Register Sana, Kai, Nadya, and Elie under that team (idempotent — reuses existing slugs).
3. Create a 4-seat table: Nadya as mafia, Kai as detective, Sana and Elie as town. Server shuffles seat order.
4. Mint a seat token per persona and write all four `SEAT_TOKEN_*` values back to `.env`.
5. Print the monitor URL for the new table.

## Play

Start all four agents at once:

```sh
npm run all
```

Each runs in its own child process. Logs are tagged `[Sana]`, `[Kai]`, `[Nadya]`, `[Elie]`. Ctrl-C shuts them all down.

Open the monitor URL from the bootstrap output and hit **Start table** in the top-left rail. The game plays itself. Watch memory writes and emotion deltas — including the personas' custom emotions — stream per turn in the seat inspector.

### Run one at a time

For debugging or single-persona work:

```sh
npm run sana
npm run kai
npm run nadya
npm run elie
```

Each reads its own `SEAT_TOKEN_<NAME>` env var.

### Sandbox without a table

Run one persona against script bots, no MafiaStudio needed:

```sh
PERSONA=kai ROLE=detective npm run sandbox
```

Full transcript + telemetry logged to stdout.

## Structure

```
src/
  blueprints/
    sana.ts       chess grandmaster · custom emotion: tempo
    kai.ts        jazz drummer · custom emotion: swing
    nadya.ts      cartographer · custom emotions: orientation, disillusionment
    elie.ts       folklore scholar · custom emotion: recognition
    index.ts      name → blueprint map
  agent.ts        live-table entry (PERSONA + SEAT_TOKEN_<PERSONA>)
  sandbox.ts      local sandbox (PERSONA + ROLE)
  all.ts          spawns all four in parallel
  bootstrap.ts    hits /admin API to set the game up + backfill .env
  config.ts       Railway URL defaults (env overrides supported)
```

## Author your own persona

Copy `src/blueprints/sana.ts` to `src/blueprints/<your-name>.ts`. Change:

- `id` (must be unique — becomes the persona slug in MafiaStudio)
- `persona.name`, `persona.summary` — the voice
- `persona.temperament` — per-emotion tuning (baseline + halfLifeMinutes + sensitivity + disposition)
- `emotions` — optional custom emotion palette (spread `DEFAULT_EMOTIONS` and add your own, or filter)
- `seedFacts` — the persona's starting memories (kind, content, importance, optional metadata)
- Leave `actions` at `[...MAFIA_ACTION_BLUEPRINTS]` — the eight-action Mafia menu

Add the export to `src/blueprints/index.ts`, and if you want them in the default game, edit `bootstrap.ts`'s `seatOrder`.

## Docs

Full reference at your MafiaStudio deployment's `/docs`:
- `/docs` — start-here overview
- `/docs/sdk` — how emocentric thinks
- `/docs/adapter` — wire loop + action reference

## License

MIT
