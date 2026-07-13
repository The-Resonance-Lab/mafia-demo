/**
 * Bootstrap a 4-persona demo game against a live MafiaStudio deployment.
 *
 * npm run bootstrap
 *
 * Registers the four personas (Vera / Marcus / Sofia / Theo) under an existing
 * team, creates a table with them seated, mints seat tokens, and prints an
 * `.env`-ready fragment you can paste and run with `npm run all`.
 *
 * Idempotent on personas — if a slug already exists it's skipped and reused.
 *
 * Needed env:
 *   MAFIA_STUDIO_URL   e.g. https://your-monitor.up.railway.app
 *   ADMIN_PASSWORD     the organizer basic-auth password
 *   TEAM_ID            uuid of the team the personas will belong to
 *                      (create the team once at /admin, copy its id)
 */
import "dotenv/config";
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
const TEAM_ID = requireEnv("TEAM_ID");

const AUTH_HEADER =
  "Basic " + Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64");

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

async function ensurePersona(name: PersonaName): Promise<PersonaRow> {
  const bp = BLUEPRINTS[name];
  const slug = bp.id;

  // Fetch existing personas — reuse if slug already registered.
  const existing = await api<{ personas: PersonaRow[] }>(
    `/api/personas?team_id=${TEAM_ID}`,
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

  const body = {
    team_id: TEAM_ID,
    slug,
    display_name: bp.persona.name,
    persona_public,
    declared_actions,
  };
  const { persona } = await api<{ persona: PersonaRow }>(`/api/personas`, {
    method: "POST",
    body,
  });
  console.log(`  · ${bp.persona.name} · registered (${persona.id})`);
  return persona;
}

async function createTable(personas: Record<PersonaName, PersonaRow>): Promise<TableRow> {
  // Balanced 4-player Mafia: 1 mafia, 1 detective, 2 town. Roles assigned by
  // position; seats get shuffled server-side so the mafia isn't always seat 0.
  const seatOrder: Array<{ persona: PersonaName; seat_role: "mafia" | "town" | "detective" }> = [
    { persona: "marcus", seat_role: "mafia" },
    { persona: "theo", seat_role: "detective" },
    { persona: "vera", seat_role: "town" },
    { persona: "sofia", seat_role: "town" },
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
    overview.seats
      .filter((s) => s.participant_id)
      .map((s) => [s.participant_id!, s]),
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
  console.log(`bootstrapping against ${MAFIA_STUDIO_URL}`);
  console.log(`team_id ${TEAM_ID}`);

  console.log(`\n[1/3] registering personas`);
  const personas: Partial<Record<PersonaName, PersonaRow>> = {};
  for (const name of Object.keys(BLUEPRINTS) as PersonaName[]) {
    personas[name] = await ensurePersona(name);
  }

  console.log(`\n[2/3] creating table`);
  const table = await createTable(personas as Record<PersonaName, PersonaRow>);
  console.log(`  · ${table.name} (${table.id})`);

  console.log(`\n[3/3] minting seat tokens`);
  const tokens = await mintTokens(
    table.id,
    personas as Record<PersonaName, PersonaRow>,
  );

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`✓ ready · paste this into .env, then \`npm run all\`:`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  console.log(`# table: ${table.name} (${table.id})`);
  for (const name of Object.keys(BLUEPRINTS) as PersonaName[]) {
    console.log(`SEAT_TOKEN_${name.toUpperCase()}=${tokens[name]}`);
  }
  console.log(`\n# open the monitor to watch it play:`);
  console.log(`# ${MAFIA_STUDIO_URL}/monitor/tables/${table.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
