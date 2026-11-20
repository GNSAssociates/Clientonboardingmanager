/**
 * Pulling the GNS CRM (crm.gnsuk.com) into the platform.
 *
 * The CRM is the master record of who is a client (migration 0031). Its API is
 * read-only: this module only ever sends GET requests, so it cannot change
 * anything in the CRM.
 *
 * WHAT IS STORED. A local copy of every CRM company record and all 13 related
 * datasets (directors, PSCs, filing history, charges, …) in `crm_companies`,
 * kept as the CRM returned them, so no field is lost and the screen can show
 * whatever the CRM holds. Each company is matched to clients here by company
 * number, and the CRM id is written to onboarding_links.external_ref, the join
 * key the platform already has. Directors and PSCs are linked to people
 * already recorded (document_people.external_ref) by name. They are never
 * ADDED: the CRM has no email addresses for them, and nobody is chased for ID
 * unless a person asks (decided 5 Nov).
 *
 * HOW IT RUNS. One full sync is about 6 list pages plus one detail request per
 * company (the detail call returns all datasets at once): ~520 requests. They
 * are made one at a time, in batches that finish well inside a web request, so
 * the cPanel account's process limit and request timeout are never at risk.
 * Progress lives in `crm_sync_runs`, so a batch can be picked up by the next
 * cron call or the next press of "Sync now". A full pass finishes the run;
 * companies the CRM no longer lists are marked, not deleted.
 *
 * Settings: CRM_API_KEY (required, the full "integration_id|secret" token),
 * CRM_API_URL (default https://crm.gnsuk.com/api/v1).
 */
import "server-only";
import { getDb } from "@gns/db";
import { sql } from "drizzle-orm";
import {
  readListPage, readDetail, readCompany, peopleOf, normaliseCompanyNumber, personKey,
  CRM_DATASETS, type Json, type CrmDataset,
} from "./crm-shape";

const BASE = () => (process.env.CRM_API_URL?.trim() || "https://crm.gnsuk.com/api/v1").replace(/\/+$/, "");
const TOKEN = () => process.env.CRM_API_KEY?.trim() || "";

export const crmConfigured = () => TOKEN().length > 0;

/* ------------------------------------------------------------------ */
/* API client                                                          */
/* ------------------------------------------------------------------ */

export class CrmAuthError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One GET. Retries a 429 (waiting as the CRM asks) and a 5xx or network error,
 * twice each. A 401/403 is not retried: the key is wrong or revoked, and
 * hammering the CRM with it would not help.
 */
async function crmGet(path: string): Promise<unknown> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(BASE() + path, {
        headers: { Authorization: `Bearer ${TOKEN()}`, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 401) throw new CrmAuthError("The CRM did not accept the API key (401). Check CRM_API_KEY is the full token, including the part before the |.");
    if (res.status === 403) throw new CrmAuthError("The CRM says this integration is inactive or revoked (403).");
    if (res.status === 404) return null;
    if (res.status === 429) {
      const wait = Math.min(60, Number(res.headers.get("retry-after")) || 5 * (attempt + 1));
      await sleep(wait * 1000);
      lastErr = "rate limited (429)";
      continue;
    }
    lastErr = `HTTP ${res.status}`;
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`CRM request failed (${path}): ${lastErr}`);
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

let ready: Promise<void> | null = null;

export function ensureCrmTables(): Promise<void> {
  if (!ready) {
    const db = getDb();
    ready = (async () => {
      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS crm_companies (
          crm_id                 text PRIMARY KEY,
          company_number         text,
          company_name           text,
          client_name            text,
          ch_status              text,
          record_status          text,
          accounts_due           date,
          confirmation_due       date,
          incorporated           date,
          profile                jsonb NOT NULL DEFAULT '{}'::jsonb,
          datasets               jsonb NOT NULL DEFAULT '{}'::jsonb,
          people                 jsonb NOT NULL DEFAULT '[]'::jsonb,
          next_verification_due  date,
          matched_tokens         text[] NOT NULL DEFAULT '{}',
          seen_run               uuid,
          detail_run             uuid,
          detail_error           text,
          first_seen_at          timestamptz NOT NULL DEFAULT now(),
          synced_at              timestamptz,
          gone_at                timestamptz
        )
      `));
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_crm_companies_number ON crm_companies (company_number)`));
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_crm_companies_seen ON crm_companies (seen_run, detail_run)`));
      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS crm_sync_runs (
          id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          trigger       text NOT NULL,
          started_by    text,
          status        text NOT NULL DEFAULT 'listing',
          list_page     integer NOT NULL DEFAULT 0,
          list_last     integer,
          total         integer,
          listed        integer NOT NULL DEFAULT 0,
          detailed      integer NOT NULL DEFAULT 0,
          failed        integer NOT NULL DEFAULT 0,
          matched       integer NOT NULL DEFAULT 0,
          people_linked integer NOT NULL DEFAULT 0,
          message       text,
          started_at    timestamptz NOT NULL DEFAULT now(),
          updated_at    timestamptz NOT NULL DEFAULT now(),
          finished_at   timestamptz
        )
      `));
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export interface SyncRun {
  id: string;
  trigger: string;
  startedBy: string | null;
  status: "listing" | "details" | "done" | "failed";
  listPage: number;
  listLast: number | null;
  total: number | null;
  listed: number;
  detailed: number;
  failed: number;
  matched: number;
  peopleLinked: number;
  message: string | null;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

const toRun = (r: Record<string, unknown>): SyncRun => ({
  id: String(r.id),
  trigger: String(r.trigger),
  startedBy: (r.started_by as string) ?? null,
  status: String(r.status) as SyncRun["status"],
  listPage: Number(r.list_page ?? 0),
  listLast: r.list_last === null || r.list_last === undefined ? null : Number(r.list_last),
  total: r.total === null || r.total === undefined ? null : Number(r.total),
  listed: Number(r.listed ?? 0),
  detailed: Number(r.detailed ?? 0),
  failed: Number(r.failed ?? 0),
  matched: Number(r.matched ?? 0),
  peopleLinked: Number(r.people_linked ?? 0),
  message: (r.message as string) ?? null,
  startedAt: new Date(String(r.started_at)).toISOString(),
  updatedAt: new Date(String(r.updated_at)).toISOString(),
  finishedAt: r.finished_at ? new Date(String(r.finished_at)).toISOString() : null,
});

export async function latestRuns(limit = 5): Promise<SyncRun[]> {
  await ensureCrmTables();
  const rows = (await getDb().execute(sql`SELECT * FROM crm_sync_runs ORDER BY started_at DESC LIMIT ${limit}`)) as unknown as Array<Record<string, unknown>>;
  return rows.map(toRun);
}

/** The run in progress, if any. One left untouched for 30 minutes is treated as stalled and can be resumed. */
async function activeRun(): Promise<SyncRun | null> {
  const rows = (await getDb().execute(sql`
    SELECT * FROM crm_sync_runs WHERE status IN ('listing','details') ORDER BY started_at DESC LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>;
  return rows[0] ? toRun(rows[0]) : null;
}

/** Start a sync, or return the one already running (two at once would only double the load on the CRM). */
export async function startRun(trigger: "manual" | "cron", startedBy: string | null): Promise<SyncRun> {
  await ensureCrmTables();
  const existing = await activeRun();
  if (existing) return existing;
  const rows = (await getDb().execute(sql`
    INSERT INTO crm_sync_runs (trigger, started_by) VALUES (${trigger}, ${startedBy}) RETURNING *
  `)) as unknown as Array<Record<string, unknown>>;
  return toRun(rows[0]!);
}

async function patchRun(id: string, set: Partial<Record<"status" | "list_page" | "list_last" | "total" | "message", string | number | null>>, add: Partial<Record<"listed" | "detailed" | "failed" | "matched" | "people_linked", number>> = {}, finish = false) {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(set, k);
  await getDb().execute(sql`
    UPDATE crm_sync_runs SET
      status        = CASE WHEN ${has("status")}    THEN ${(set.status as string) ?? null} ELSE status END,
      list_page     = CASE WHEN ${has("list_page")} THEN ${(set.list_page as number) ?? 0}::int ELSE list_page END,
      list_last     = CASE WHEN ${has("list_last")} THEN ${(set.list_last as number) ?? null}::int ELSE list_last END,
      total         = CASE WHEN ${has("total")}     THEN ${(set.total as number) ?? null}::int ELSE total END,
      message       = CASE WHEN ${has("message")}   THEN ${(set.message as string) ?? null} ELSE message END,
      listed        = listed + ${add.listed ?? 0},
      detailed      = detailed + ${add.detailed ?? 0},
      failed        = failed + ${add.failed ?? 0},
      matched       = matched + ${add.matched ?? 0},
      people_linked = people_linked + ${add.people_linked ?? 0},
      updated_at    = now(),
      finished_at   = CASE WHEN ${finish} THEN now() ELSE finished_at END
    WHERE id = ${id}::uuid
  `);
}

/* ------------------------------------------------------------------ */
/* One batch of work                                                    */
/* ------------------------------------------------------------------ */

const PER_PAGE = 100;
/** Pause between requests: gentle on the CRM, and on our own server. */
const GAP_MS = 150;

/**
 * Do as much of the sync as fits in `budgetMs`, then stop and report. Call
 * again (the next cron tick, or the screen's loop) until status is done.
 */
export async function stepRun(runId: string, budgetMs = 20000): Promise<SyncRun> {
  await ensureCrmTables();
  const until = Date.now() + budgetMs;
  const db = getDb();
  const load = async () => toRun(((await db.execute(sql`SELECT * FROM crm_sync_runs WHERE id = ${runId}::uuid`)) as unknown as Array<Record<string, unknown>>)[0]!);
  let run = await load();

  try {
    // 1. Walk the list: who is in the CRM today.
    while (run.status === "listing" && Date.now() < until) {
      const page = run.listPage + 1;
      const body = await crmGet(`/company-records?per_page=${PER_PAGE}&page=${page}`);
      const p = readListPage(body, page);
      let listed = 0;
      for (const row of p.rows) {
        const c = readCompany(row);
        if (!c) continue;
        await db.execute(sql`
          INSERT INTO crm_companies (crm_id, company_number, company_name, client_name, ch_status, record_status,
                                     accounts_due, confirmation_due, incorporated, seen_run, gone_at)
          VALUES (${c.crmId}, ${c.companyNumber}, ${c.companyName}, ${c.clientName}, ${c.companiesHouseStatus}, ${c.recordStatus},
                  ${c.accountsDue}::date, ${c.confirmationStatementDue}::date, ${c.incorporated}::date, ${runId}::uuid, NULL)
          ON CONFLICT (crm_id) DO UPDATE SET
            company_number = COALESCE(EXCLUDED.company_number, crm_companies.company_number),
            company_name   = COALESCE(EXCLUDED.company_name, crm_companies.company_name),
            client_name    = COALESCE(EXCLUDED.client_name, crm_companies.client_name),
            ch_status      = COALESCE(EXCLUDED.ch_status, crm_companies.ch_status),
            record_status  = COALESCE(EXCLUDED.record_status, crm_companies.record_status),
            seen_run       = EXCLUDED.seen_run,
            gone_at        = NULL
        `);
        listed++;
      }
      const done = !p.rows.length || p.page >= p.lastPage;
      await patchRun(runId, { list_page: page, list_last: p.lastPage, total: p.total ?? null, ...(done ? { status: "details" } : {}) }, { listed });
      run = await load();
      await sleep(GAP_MS);
    }

    // 2. Each company in full: profile and all 13 datasets in one request.
    while (run.status === "details" && Date.now() < until) {
      const next = (await db.execute(sql`
        SELECT crm_id FROM crm_companies
        WHERE seen_run = ${runId}::uuid AND detail_run IS DISTINCT FROM ${runId}::uuid
        ORDER BY crm_id LIMIT 10
      `)) as unknown as Array<{ crm_id: string }>;

      if (!next.length) {
        // Finished: anything the CRM no longer lists is marked, kept for the record.
        await db.execute(sql`UPDATE crm_companies SET gone_at = now() WHERE seen_run IS DISTINCT FROM ${runId}::uuid AND gone_at IS NULL`);
        await patchRun(runId, { status: "done", message: null }, {}, true);
        return load();
      }

      for (const { crm_id } of next) {
        if (Date.now() >= until) break;
        let ok = false;
        let matched = 0;
        let linked = 0;
        try {
          const body = await crmGet(`/company-records/${encodeURIComponent(crm_id)}`);
          if (body) {
            const r = await saveDetail(crm_id, body, runId);
            matched = r.matched;
            linked = r.peopleLinked;
            ok = true;
          } else {
            await db.execute(sql`UPDATE crm_companies SET detail_run = ${runId}::uuid, detail_error = 'not found in CRM' WHERE crm_id = ${crm_id}`);
          }
        } catch (e) {
          if (e instanceof CrmAuthError) throw e;
          await db.execute(sql`UPDATE crm_companies SET detail_run = ${runId}::uuid, detail_error = ${e instanceof Error ? e.message.slice(0, 300) : String(e)} WHERE crm_id = ${crm_id}`);
        }
        await patchRun(runId, {}, { detailed: ok ? 1 : 0, failed: ok ? 0 : 1, matched, people_linked: linked });
        await sleep(GAP_MS);
      }
      run = await load();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // A bad key stops the run; anything else leaves it to be resumed.
    await patchRun(runId, e instanceof CrmAuthError ? { status: "failed", message } : { message }, {}, e instanceof CrmAuthError);
  }
  return load();
}

/** Store one company's full record and match it to clients and people here. */
async function saveDetail(crmId: string, body: unknown, runId: string): Promise<{ matched: number; peopleLinked: number }> {
  const db = getDb();
  const d = readDetail(body);
  const c = d.company;
  const people = peopleOf(d.datasets);
  const nextDue = people
    .filter((p) => p.current && p.verificationDue && !p.verifiedOn)
    .map((p) => p.verificationDue!)
    .sort()[0] ?? null;
  const datasets: Record<string, Json[]> = {};
  for (const ds of CRM_DATASETS) if (d.datasets[ds]) datasets[ds] = d.datasets[ds as CrmDataset]!;

  // Clients here with the same company number. Re-engagements can mean more than one.
  const number = c?.companyNumber ?? normaliseCompanyNumber(null);
  let tokens: string[] = [];
  if (number) {
    const rows = (await db.execute(sql`
      SELECT token FROM onboarding_links
      WHERE upper(regexp_replace(coalesce(company_number,''), '\\s', '', 'g')) IN (${number}, ${number.replace(/^0+/, "")})
    `)) as unknown as Array<{ token: string }>;
    tokens = rows.map((r) => r.token);
  }

  await db.execute(sql`
    UPDATE crm_companies SET
      company_number    = COALESCE(${c?.companyNumber ?? null}, company_number),
      company_name      = COALESCE(${c?.companyName ?? null}, company_name),
      client_name       = COALESCE(${c?.clientName ?? null}, client_name),
      ch_status         = COALESCE(${c?.companiesHouseStatus ?? null}, ch_status),
      record_status     = COALESCE(${c?.recordStatus ?? null}, record_status),
      accounts_due      = ${c?.accountsDue ?? null}::date,
      confirmation_due  = ${c?.confirmationStatementDue ?? null}::date,
      incorporated      = ${c?.incorporated ?? null}::date,
      profile           = ${JSON.stringify(d.profile)}::jsonb,
      datasets          = ${JSON.stringify(datasets)}::jsonb,
      people            = ${JSON.stringify(people)}::jsonb,
      next_verification_due = ${nextDue}::date,
      matched_tokens    = ${`{${tokens.map((t) => `"${t}"`).join(",")}}`}::text[],
      detail_run        = ${runId}::uuid,
      detail_error      = NULL,
      synced_at         = now()
    WHERE crm_id = ${crmId}
  `);

  let matched = 0;
  let peopleLinked = 0;
  if (tokens.length) {
    // Write the CRM id only where it is missing or already this one: never re-point a client
    // that was linked to a different CRM record. That conflict is shown on screen instead.
    const r = (await db.execute(sql`
      UPDATE onboarding_links SET external_ref = ${crmId}
      WHERE token = ANY(${`{${tokens.map((t) => `"${t}"`).join(",")}}`}::text[])
        AND (external_ref IS NULL OR external_ref = ${crmId})
      RETURNING token
    `)) as unknown as Array<{ token: string }>;
    matched = r.length ? 1 : 0;

    // People already recorded on those clients, linked by name.
    try {
      const recorded = (await db.execute(sql`
        SELECT ref, name FROM document_people
        WHERE link_token = ANY(${`{${tokens.map((t) => `"${t}"`).join(",")}}`}::text[]) AND external_ref IS NULL
      `)) as unknown as Array<{ ref: string; name: string }>;
      for (const rp of recorded) {
        const k = personKey(rp.name);
        const hit = k ? people.find((p) => p.key === k) : null;
        if (!hit) continue;
        await db.execute(sql`UPDATE document_people SET external_ref = ${`${crmId}:${hit.kind}:${hit.key}`} WHERE ref = ${rp.ref} AND external_ref IS NULL`);
        peopleLinked++;
      }
    } catch { /* document_people not created yet on this database: nothing to link */ }
  }
  return { matched, peopleLinked };
}

/* ------------------------------------------------------------------ */
/* Reading the stored copy                                              */
/* ------------------------------------------------------------------ */

export interface CrmCompanyRow {
  crmId: string;
  companyNumber: string | null;
  companyName: string | null;
  clientName: string | null;
  chStatus: string | null;
  recordStatus: string | null;
  accountsDue: string | null;
  confirmationDue: string | null;
  nextVerificationDue: string | null;
  matchedTokens: string[];
  syncedAt: string | null;
  gone: boolean;
  detailError: string | null;
}

const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : null);

export type CrmView = "all" | "unmatched" | "verification" | "problems" | "gone";

export async function listCrmCompanies(view: CrmView, q: string, limit = 200): Promise<CrmCompanyRow[]> {
  await ensureCrmTables();
  const like = q.trim() ? `%${q.trim().toLowerCase()}%` : null;
  const rows = (await getDb().execute(sql`
    SELECT crm_id, company_number, company_name, client_name, ch_status, record_status, accounts_due, confirmation_due,
           next_verification_due, matched_tokens, synced_at, gone_at, detail_error
    FROM crm_companies
    WHERE (${like}::text IS NULL OR lower(coalesce(company_name,'') || ' ' || coalesce(client_name,'') || ' ' || coalesce(company_number,'')) LIKE ${like})
      AND CASE ${view}
            WHEN 'unmatched'    THEN gone_at IS NULL AND cardinality(matched_tokens) = 0
            WHEN 'verification' THEN gone_at IS NULL AND next_verification_due IS NOT NULL AND next_verification_due <= current_date + 30
            WHEN 'problems'     THEN detail_error IS NOT NULL
            WHEN 'gone'         THEN gone_at IS NOT NULL
            ELSE gone_at IS NULL
          END
    ORDER BY CASE WHEN ${view} = 'verification' THEN next_verification_due END ASC NULLS LAST,
             lower(coalesce(company_name, client_name, ''))
    LIMIT ${limit}
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    crmId: String(r.crm_id),
    companyNumber: (r.company_number as string) ?? null,
    companyName: (r.company_name as string) ?? null,
    clientName: (r.client_name as string) ?? null,
    chStatus: (r.ch_status as string) ?? null,
    recordStatus: (r.record_status as string) ?? null,
    accountsDue: d10(r.accounts_due),
    confirmationDue: d10(r.confirmation_due),
    nextVerificationDue: d10(r.next_verification_due),
    matchedTokens: Array.isArray(r.matched_tokens) ? (r.matched_tokens as string[]) : [],
    syncedAt: r.synced_at ? new Date(String(r.synced_at)).toISOString() : null,
    gone: Boolean(r.gone_at),
    detailError: (r.detail_error as string) ?? null,
  }));
}

export async function crmCounts(): Promise<Record<CrmView, number>> {
  await ensureCrmTables();
  const r = ((await getDb().execute(sql`
    SELECT
      count(*) FILTER (WHERE gone_at IS NULL)::int AS live,
      count(*) FILTER (WHERE gone_at IS NULL AND cardinality(matched_tokens) = 0)::int AS unmatched,
      count(*) FILTER (WHERE gone_at IS NULL AND next_verification_due IS NOT NULL AND next_verification_due <= current_date + 30)::int AS verification,
      count(*) FILTER (WHERE detail_error IS NOT NULL)::int AS problems,
      count(*) FILTER (WHERE gone_at IS NOT NULL)::int AS gone
    FROM crm_companies
  `)) as unknown as Array<Record<string, number>>)[0] ?? {};
  return { all: r.live ?? 0, unmatched: r.unmatched ?? 0, verification: r.verification ?? 0, problems: r.problems ?? 0, gone: r.gone ?? 0 };
}

export async function getCrmCompany(crmId: string): Promise<(CrmCompanyRow & { profile: Json; datasets: Record<string, Json[]>; people: unknown[] }) | null> {
  await ensureCrmTables();
  const rows = (await getDb().execute(sql`SELECT * FROM crm_companies WHERE crm_id = ${crmId}`)) as unknown as Array<Record<string, unknown>>;
  const r = rows[0];
  if (!r) return null;
  const parse = (v: unknown, dflt: unknown) => { try { return typeof v === "string" ? JSON.parse(v) : (v ?? dflt); } catch { return dflt; } };
  return {
    crmId: String(r.crm_id),
    companyNumber: (r.company_number as string) ?? null,
    companyName: (r.company_name as string) ?? null,
    clientName: (r.client_name as string) ?? null,
    chStatus: (r.ch_status as string) ?? null,
    recordStatus: (r.record_status as string) ?? null,
    accountsDue: d10(r.accounts_due),
    confirmationDue: d10(r.confirmation_due),
    nextVerificationDue: d10(r.next_verification_due),
    matchedTokens: Array.isArray(r.matched_tokens) ? (r.matched_tokens as string[]) : [],
    syncedAt: r.synced_at ? new Date(String(r.synced_at)).toISOString() : null,
    gone: Boolean(r.gone_at),
    detailError: (r.detail_error as string) ?? null,
    profile: parse(r.profile, {}) as Json,
    datasets: parse(r.datasets, {}) as Record<string, Json[]>,
    people: parse(r.people, []) as unknown[],
  };
}
