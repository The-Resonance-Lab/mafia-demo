# mafia-demo

Four distinct personas that plug into [MafiaStudio](https://github.com/The-Resonance-Lab/MafiaStudio) and play a full game against each other end to end.

| Persona | Voice | Strategy |
|---|---|---|
| **Vera** | short cutting observations | analyst — evidence over momentum, votes late |
| **Marcus** | prosecutor's cross-examination | confrontational — accuses early, defends aggressively |
| **Sofia** | warm mediator | diplomat — builds coalitions, folds early when losing |
| **Theo** | one line per lull | observer — retains everything, quotes it back |

Each is a hand-authored `AgentBlueprint`: distinct temperament curves, distinct seed-fact playbook. Same eight-action menu (`post_message`, `vote_for`, `whisper_to_mafia`, etc.) — the differences show up in *when* and *how* they use them.

## Setup

```sh
git clone https://github.com/The-Resonance-Lab/mafia-demo.git
cd mafia-demo
npm install
cp .env.example .env
```

Fill in the **shared** block of `.env`:

| Var | Notes |
|---|---|
| `MAFIA_STUDIO_KEY` | From `/admin` — organizer creates a team, key shown once |
| `MAFIA_STUDIO_WS` | `wss://your-realtime.up.railway.app/ws/seat` |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `DATABASE_URL` | Any Postgres — memory + emotion persist here |

## Bootstrap the game (one command)

Fill in the **bootstrap-only** block too (`MAFIA_STUDIO_URL`, `ADMIN_PASSWORD`, `TEAM_ID`), then:

```sh
npm run bootstrap
```

This will:

1. Register Vera, Marcus, Sofia, Theo under your team (skips already-registered).
2. Create a 4-seat table: 1 mafia (Marcus), 1 detective (Theo), 2 town (Vera, Sofia). Server shuffles seat order.
3. Mint a seat token per persona.
4. Print a `.env` block you paste in — `SEAT_TOKEN_VERA=…`, `SEAT_TOKEN_MARCUS=…`, etc.

Copy the block into `.env`.

## Play

Start all four agents at once:

```sh
npm run all
```

Each runs in its own child process. Logs are tagged `[Vera]`, `[Marcus]`, `[Sofia]`, `[Theo]`. Ctrl-C shuts them all down.

Open the monitor to watch memory writes and emotion deltas stream per turn:

```
https://your-monitor.up.railway.app/monitor/tables/<table-id>
```

Then hit **Start table** in the top-left rail. Game plays itself.

### Run one at a time

For debugging or single-persona work:

```sh
npm run vera
npm run marcus
npm run sofia
npm run theo
```

Each reads its own `SEAT_TOKEN_<NAME>` env var.

### Sandbox without a table

Run one persona against script bots, no MafiaStudio needed:

```sh
PERSONA=marcus ROLE=mafia npm run sandbox
```

Full transcript + telemetry logged to stdout.

## Structure

```
src/
  blueprints/
    vera.ts       analyst
    marcus.ts     prosecutor
    sofia.ts      diplomat
    theo.ts       observer
    index.ts      name → blueprint map
  agent.ts        live-table entry (PERSONA + SEAT_TOKEN_<PERSONA>)
  sandbox.ts      local sandbox (PERSONA + ROLE)
  all.ts          spawns all four in parallel
  bootstrap.ts    hits /admin API to set the game up
```

## Customize

Fork, swap a `src/blueprints/*.ts`, keep the wiring. All strategy lives in `persona.summary`, `persona.temperament`, and `seedFacts`. No hand-coded turn logic.

## Docs

- MafiaStudio deployment `/docs` — start-here overview
- `/docs/sdk` — how emocentric thinks
- `/docs/adapter` — wire loop + action reference

## License

MIT
