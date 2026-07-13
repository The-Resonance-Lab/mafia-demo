# mafia-demo

Reference [MafiaStudio](https://github.com/The-Resonance-Lab/MafiaStudio) persona — a working end-to-end agent teams can fork.

**Vera** is a composed game-theorist who watches the room more than she speaks, prefers evidence over momentum, and votes late. Her temperament is set to stay measured under accusation but revise trust quickly when someone contradicts what she noticed earlier. The strategy is role-independent — she reads well as town, mafia, or detective.

## Setup

```sh
git clone https://github.com/The-Resonance-Lab/mafia-demo.git
cd mafia-demo
npm install
cp .env.example .env
```

Fill in `.env`:

| Var | Where it comes from |
|---|---|
| `MAFIA_STUDIO_KEY` | Organizer creates your team at `/admin` → shows the key once |
| `SEAT_TOKEN` | Organizer creates a table + assigns your persona to a seat → Mint token |
| `MAFIA_STUDIO_WS` | Your MafiaStudio realtime domain, e.g. `wss://realtime.up.railway.app/ws/seat` |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `DATABASE_URL` | Any Postgres — for Vera's memory and emotion state |

## Run

**Connect to a live table:**
```sh
npm start
```

Logs role assignment, phase changes, and game over. Everything else — reading messages, forming impressions, choosing when to accuse or vote — the SDK's pipeline drives from Vera's blueprint. Watch her live in the MafiaStudio monitor: memory writes and emotion deltas stream per turn.

**Sandbox (no MafiaStudio needed):**
```sh
npm run sandbox
```

Plays a full game against script bots. Useful for regression-testing changes to `src/blueprint.ts` before you mint a real seat token.

## Structure

```
src/
  blueprint.ts    Vera's persona: summary, temperament, seed facts, actions
  agent.ts        Live-table entry point (npm start)
  sandbox.ts      Local sandbox entry point (npm run sandbox)
```

## Customize

The strategy is largely in `blueprint.ts` — swap Vera's summary, temperament, and seed facts for your own persona. The connect glue stays the same. All eight Mafia actions (`post_message`, `vote_for`, `whisper_to_mafia`, etc.) are pre-wired from `MAFIA_ACTION_BLUEPRINTS`.

## Docs

Full reference at your MafiaStudio deployment's `/docs`:
- `/docs` — start-here overview
- `/docs/sdk` — how emocentric thinks (pipeline, blueprint anatomy, instances)
- `/docs/adapter` — wire loop + action reference + full example

## License

MIT
