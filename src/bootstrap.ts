/**
 * Bootstrap a 4-persona demo game against a live MafiaStudio deployment.
 *
 * npm run bootstrap
 *
 * If TEAM_ID + MAFIA_STUDIO_KEY are missing from .env, creates a team, writes
 * both back. Then registers the four personas, creates a 4-seat table, mints
 * seat tokens, and writes SEAT_TOKEN_<PERSONA> back too. After this runs,
 * `.env` is fully filled and `npm run all` is the next step.
 *
 * Idempotent: personas with a matching slug are reused; existing MAFIA_STUDIO_KEY
 * + TEAM_ID are preserved.
 *
 * Only required env:
 *   ADMIN_PASSWORD     the organizer basic-auth password
 * (Everything else is either baked in via src/config.ts or minted below.)
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { BLUEPRINTS, type PersonaName } from "./blueprints/index.js";
import { MAFIA_STUDIO_URL } from "./config.js";

interface PersonaTemperament {
  emotion: string;
  baseline?: number;
  halfLifeMinutes?: number;
  sensitivity?: number;
  disposition?: string;
}

interface PersonaPublic {
  summary: string;
  temperament: PersonaTemperament[];
}

interface TeamRow {
  id: string;
  slug: string;
  name: string;
  contact_email: string;
}

interface PersonaRow {
  id: string;
  slug: string;
  display_name: string;
}

interface TableRow {
  id: string;
  name: string;
}

interface MonitorSeat {
  id: string;
  display_label: string;
  participant_type: string;
  seat_role: string;
  participant_id: string | null;
}

interface SeatTokenResponse {
  token: string;
  seat_id: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

const ADMIN_PASSWORD = requireEnv("ADMIN_PASSWORD");

const AUTH_HEADER =
  "Basic " + Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64");

const ENV_PATH = resolve(process.cwd(), ".env");

/** Read the .env file, update a set of keys, write back. Preserves ordering,
 *  comments, and unrelated keys. Appends missing keys at the end. */
function updateEnvFile(updates: Record<string, string>): void {
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const lines = existing.split(/\r?\n/);
  const remaining = new Set(Object.keys(updates));

  const patched = lines.map((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (!m) return line;
    const key = m[1]!;
    if (!(key in updates)) return line;
    remaining.delete(key);
    return `${key}=${updates[key]}`;
  });

  for (const key of remaining) {
    patched.push(`${key}=${updates[key]}`);
  }

  writeFileSync(ENV_PATH, patched.join("\n"));
}

async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const url = `${MAFIA_STUDIO_URL}${path}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      authorization: AUTH_HEADER,
      "content-type": "application/json",
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${opts.method ?? "GET"} ${path} → ${res.status}\n${text}`);
  }
  return (await res.json()) as T;
}

/** Ensure MAFIA_STUDIO_KEY + TEAM_ID exist. Creates a team if neither is set. */
async function ensureTeam(): Promise<string> {
  const existingId = process.env.TEAM_ID?.trim();
  const existingKey = process.env.MAFIA_STUDIO_KEY?.trim();
  if (existingId && existingKey) {
    console.log(`  · reusing team ${existingId}`);
    return existingId;
  }

  const slug = process.env.TEAM_SLUG?.trim() ||
    `demo-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;
  const name = process.env.TEAM_NAME?.trim() || "Demo Team";
  const contact_email =
    process.env.TEAM_EMAIL?.trim() || `demo+${slug}@example.com`;

  const { team, api_key } = await api<{ team: TeamRow; api_key: string }>(
    `/api/teams`,
    { method: "POST", body: { name, slug, contact_email } },
  );

  updateEnvFile({ TEAM_ID: team.id, MAFIA_STUDIO_KEY: api_key });
  console.log(`  · created team ${team.slug} (${team.id})`);
  console.log(`  · wrote MAFIA_STUDIO_KEY + TEAM_ID back to .env`);
  return team.id;
}

async function ensurePersona(teamId: string, name: PersonaName): Promise<PersonaRow> {
  const bp = BLUEPRINTS[name];
  const slug = bp.id;

  const existing = await api<{ personas: PersonaRow[] }>(
    `/api/personas?team_id=${teamId}`,
  );
  const found = existing.personas.find((p) => p.slug === slug);
  if (found) {
    console.log(`  · ${bp.persona.name} · reusing (${found.id})`);
    return found;
  }

  const persona_public: PersonaPublic = {
    summary: bp.persona.summary,
    temperament: (bp.persona.temperament ?? []).map((t) => ({
      emotion: t.emotion,
      baseline: t.baseline,
      halfLifeMinutes: t.halfLifeMinutes,
      sensitivity: t.sensitivity,
      disposition: t.disposition,
    })),
  };
  const declared_actions = (bp.actions ?? []).map((a) => a.name);

  const { persona } = await api<{ persona: PersonaRow }>(`/api/personas`, {
    method: "POST",
    body: {
      team_id: teamId,
      slug,
      display_name: bp.persona.name,
      persona_public,
      declared_actions,
    },
  });
  console.log(`  · ${bp.persona.name} · registered (${persona.id})`);
  return persona;
}

async function createTable(personas: Record<PersonaName, PersonaRow>): Promise<TableRow> {
  // Balanced 4-player Mafia: 1 mafia, 1 detective, 2 town. Role assignment is
  // deliberate — Kai's rhythm-reading suits the detective's investigative bent,
  // Nadya's bitter cartography reads well as mafia (she distrusts consensus,
  // which is useful when hiding among town), and the two "town" seats get
  // Sana (patient) and Elie (pattern-matching) — a compelling contrast.
  const seatOrder: Array<{ persona: PersonaName; seat_role: "mafia" | "town" | "detective" }> = [
    { persona: "nadya", seat_role: "mafia" },
    { persona: "kai", seat_role: "detective" },
    { persona: "sana", seat_role: "town" },
    { persona: "elie", seat_role: "town" },
  ];
  const seats = seatOrder.map((s) => ({
    participant_type: "persona" as const,
    seat_role: s.seat_role,
    persona_id: personas[s.persona].id,
  }));
  const name = `demo-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
  const { table } = await api<{ table: TableRow }>(`/api/tables`, {
    method: "POST",
    body: { name, seats },
  });
  return table;
}

async function mintTokens(
  tableId: string,
  personas: Record<PersonaName, PersonaRow>,
): Promise<Record<PersonaName, string>> {
  const overview = await api<{ seats: MonitorSeat[] }>(
    `/api/tables/${tableId}/monitor`,
  );
  const seatByPersonaId = new Map(
    overview.seats.filter((s) => s.participant_id).map((s) => [s.participant_id!, s]),
  );

  const tokens: Partial<Record<PersonaName, string>> = {};
  for (const [name, persona] of Object.entries(personas) as [PersonaName, PersonaRow][]) {
    const seat = seatByPersonaId.get(persona.id);
    if (!seat) throw new Error(`no seat for persona ${persona.slug}`);
    const { token } = await api<SeatTokenResponse>(
      `/api/seats/${seat.id}/token`,
      { method: "POST" },
    );
    tokens[name] = token;
    console.log(`  · ${persona.display_name} · seat ${seat.display_label}`);
  }
  return tokens as Record<PersonaName, string>;
}

async function main(): Promise<void> {
  console.log(`bootstrapping against ${MAFIA_STUDIO_URL}\n`);

  console.log(`[1/4] team`);
  const teamId = await ensureTeam();

  console.log(`\n[2/4] personas`);
  const personas: Partial<Record<PersonaName, PersonaRow>> = {};
  for (const name of Object.keys(BLUEPRINTS) as PersonaName[]) {
    personas[name] = await ensurePersona(teamId, name);
  }

  console.log(`\n[3/4] table`);
  const table = await createTable(personas as Record<PersonaName, PersonaRow>);
  console.log(`  · ${table.name} (${table.id})`);

  console.log(`\n[4/4] seat tokens`);
  const tokens = await mintTokens(table.id, personas as Record<PersonaName, PersonaRow>);

  const tokenUpdates: Record<string, string> = {};
  for (const name of Object.keys(tokens) as PersonaName[]) {
    tokenUpdates[`SEAT_TOKEN_${name.toUpperCase()}`] = tokens[name];
  }
  updateEnvFile(tokenUpdates);

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`✓ ready · .env is fully wired · run:`);
  console.log(`      npm run all`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`\nthen open the monitor to watch it play:`);
  console.log(`  ${MAFIA_STUDIO_URL}/monitor/tables/${table.id}`);
  console.log(`\nand click "Start table" in the top-left rail.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
