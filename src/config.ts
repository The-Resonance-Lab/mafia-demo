/**
 * Deployment defaults.
 *
 * Baked in so demo runners never have to type Railway URLs. Env vars still
 * override if you want to point at a different deployment (staging, local
 * docker, whatever) — see `.env.example`.
 */

const DEFAULT_MONITOR_URL = "https://monitor-production-9d42.up.railway.app";
const DEFAULT_REALTIME_WS = "wss://realtime-production-4e96.up.railway.app/ws/seat";

export const MAFIA_STUDIO_URL = (
  process.env.MAFIA_STUDIO_URL ?? DEFAULT_MONITOR_URL
).replace(/\/$/, "");

export const MAFIA_STUDIO_WS =
  process.env.MAFIA_STUDIO_WS ?? DEFAULT_REALTIME_WS;
