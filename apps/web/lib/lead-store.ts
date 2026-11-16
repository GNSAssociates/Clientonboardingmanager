/**
 * Storing leads: enquiries from the website, the info@ inbox and the phone,
 * before anyone has agreed to become a client.
 *
 * A lead is not a client. Most never sign, and putting every enquiry into the
 * clients table (as the original `createLead` service does) would fill the
 * client list, the compliance dashboards and Companies House syncing with
 * people we never acted for. So leads live in their own table, and a lead
 * becomes a client only through the partner intake form, where it already
 * would have started. `intake_token` records that hand-off.
 *
 * The table is created with CREATE TABLE IF NOT EXISTS on first use, for the
 * same reason as handover-store.ts: the deploy path does not run migrations.
 * Every statement is safe to run repeatedly.
 *
 * Every value is bound, never interpolated: these rows hold names, phone
 * numbers and whatever a stranger typed into a public form.
 */
import { getDb } from "@gns/db";
import { sql } from "drizzle-orm";
import {
  leadDedupeKey, LEAD_STATUSES,
  type LeadSource, type LeadStatus, type ParsedLead,
} from "./lead-parse";

let ready: Promise<void> | null = null;

export function ensureLeadsTable(): Promise<void> {
  if (!ready) {
    const db = getDb();
    ready = (async () => {
      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS leads (
          id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          received_at     timestamptz NOT NULL DEFAULT now(),
          source          text NOT NULL DEFAULT 'website',
          status          text NOT NULL DEFAULT 'new',
          name            text,
          email           text,
          phone           text,
          company_name    text,
          company_number  text,
          services        text,
          message         text,
          extra           jsonb NOT NULL DEFAULT '[]'::jsonb,
          form_id         text,
          form_name       text,
          entry_id        text,
          page_url        text,
          firm_slug       text,
          spam_reason     text,
          owner_id        uuid,
          owner_name      text,
          next_action_on  date,
          notes           text,
          lost_reason     text,
          intake_token    text,
          raw             jsonb,
          dedupe_key      text,
          created_by      uuid,
          updated_by      uuid,
          updated_at      timestamptz NOT NULL DEFAULT now(),
          deleted_at      timestamptz
        )
      `));
      await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_dedupe ON leads (dedupe_key) WHERE dedupe_key IS NOT NULL`));
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status, received_at DESC) WHERE deleted_at IS NULL`));
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (lower(email)) WHERE email IS NOT NULL`));
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export interface Lead {
  id: string;
  receivedAt: string;
  source: LeadSource;
  status: LeadStatus;
  name: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  companyNumber: string | null;
  services: string | null;
  message: string | null;
  extra: Array<{ label: string; value: string }>;
  formName: string | null;
  pageUrl: string | null;
  firmSlug: string | null;
  spamReason: string | null;
  ownerId: string | null;
  ownerName: string | null;
  nextActionOn: string | null;
  notes: string | null;
  lostReason: string | null;
  intakeToken: string | null;
  updatedAt: string;
  /** How many earlier leads share this email or phone: a returning enquirer. */
  previousEnquiries: number;
}

function toLead(r: Record<string, unknown>): Lead {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");
  let extra: Lead["extra"] = [];
  try {
    const e = typeof r.extra === "string" ? JSON.parse(r.extra) : r.extra;
    if (Array.isArray(e)) extra = e as Lead["extra"];
  } catch { /* a malformed row still shows */ }
  return {
    id: String(r.id),
    receivedAt: iso(r.received_at),
    source: String(r.source ?? "website") as LeadSource,
    status: String(r.status ?? "new") as LeadStatus,
    name: (r.name as string) ?? null,
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    companyName: (r.company_name as string) ?? null,
    companyNumber: (r.company_number as string) ?? null,
    services: (r.services as string) ?? null,
    message: (r.message as string) ?? null,
    extra,
    formName: (r.form_name as string) ?? null,
    pageUrl: (r.page_url as string) ?? null,
    firmSlug: (r.firm_slug as string) ?? null,
    spamReason: (r.spam_reason as string) ?? null,
    ownerId: (r.owner_id as string) ?? null,
    ownerName: (r.owner_name as string) ?? null,
    nextActionOn: r.next_action_on ? String(r.next_action_on).slice(0, 10) : null,
    notes: (r.notes as string) ?? null,
    lostReason: (r.lost_reason as string) ?? null,
    intakeToken: (r.intake_token as string) ?? null,
    updatedAt: iso(r.updated_at),
    previousEnquiries: Number(r.previous_enquiries ?? 0),
  };
}

/**
 * Store one enquiry. Returns the lead and whether it was new.
 *
 * A repeat of the same enquiry (WordPress retrying, a double-click on Submit)
 * hits the unique dedupe key and returns the existing row instead of a copy.
 */
export async function insertLead(
  p: ParsedLead,
  opts: { source: LeadSource; firmSlug?: string | null; raw?: unknown; createdBy?: string | null; notes?: string | null },
): Promise<{ id: string; created: boolean }> {
  await ensureLeadsTable();
  const db = getDb();
  const now = new Date();
  // Typed in by staff: never deduplicated, they meant to add it.
  const key = opts.source === "website" ? leadDedupeKey(p, now) : null;
  const status: LeadStatus = p.looksLikeSpam ? "spam" : "new";

  const rows = (await db.execute(sql`
    INSERT INTO leads
      (source, status, name, email, phone, company_name, company_number, services, message,
       extra, form_id, form_name, entry_id, page_url, firm_slug, spam_reason, notes, raw,
       dedupe_key, created_by, updated_by)
    VALUES (
      ${opts.source}, ${status}, ${p.name}, ${p.email}, ${p.phone}, ${p.companyName}, ${p.companyNumber},
      ${p.services}, ${p.message}, ${JSON.stringify(p.extra)}::jsonb, ${p.formId}, ${p.formName}, ${p.entryId},
      ${p.pageUrl}, ${opts.firmSlug ?? null}, ${p.spamReason}, ${opts.notes ?? null},
      ${opts.raw === undefined ? null : JSON.stringify(opts.raw)}::jsonb,
      ${key}, ${opts.createdBy ?? null}::uuid, ${opts.createdBy ?? null}::uuid
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING id
  `)) as unknown as Array<{ id: string }>;

  if (rows[0]) return { id: String(rows[0].id), created: true };

  const existing = (await db.execute(sql`SELECT id FROM leads WHERE dedupe_key = ${key} LIMIT 1`)) as unknown as Array<{ id: string }>;
  return { id: String(existing[0]?.id ?? ""), created: false };
}

const SELECT_LEAD = sql`
  SELECT l.*,
    (SELECT count(*) FROM leads p
      WHERE p.deleted_at IS NULL AND p.id <> l.id AND p.received_at < l.received_at
        AND ((l.email IS NOT NULL AND lower(p.email) = lower(l.email))
          OR (l.phone IS NOT NULL AND p.phone = l.phone))) AS previous_enquiries
  FROM leads l
`;

export type LeadView = "open" | "all" | LeadStatus;

/** Statuses still needing someone to act. Won, lost and spam are closed. */
const OPEN: LeadStatus[] = ["new", "contacted", "meeting", "proposal"];

export async function listLeads(view: LeadView = "open", search = "", limit = 300): Promise<Lead[]> {
  await ensureLeadsTable();
  const db = getDb();
  const statuses: string[] =
    view === "open" ? OPEN : view === "all" ? LEAD_STATUSES.filter((s) => s !== "spam") : [view];
  const q = search.trim() ? `%${search.trim().toLowerCase()}%` : null;

  const rows = (await db.execute(sql`
    ${SELECT_LEAD}
    WHERE l.deleted_at IS NULL
      AND l.status = ANY(${`{${statuses.join(",")}}`}::text[])
      AND (${q}::text IS NULL
        OR lower(coalesce(l.name,''))         LIKE ${q}
        OR lower(coalesce(l.email,''))        LIKE ${q}
        OR lower(coalesce(l.phone,''))        LIKE ${q}
        OR lower(coalesce(l.company_name,'')) LIKE ${q}
        OR lower(coalesce(l.message,''))      LIKE ${q})
    ORDER BY
      CASE WHEN l.status = 'new' THEN 0 ELSE 1 END,
      l.next_action_on ASC NULLS LAST,
      l.received_at DESC
    LIMIT ${limit}
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map(toLead);
}

export async function getLead(id: string): Promise<Lead | null> {
  await ensureLeadsTable();
  const db = getDb();
  const rows = (await db.execute(sql`${SELECT_LEAD} WHERE l.id = ${id}::uuid AND l.deleted_at IS NULL`)) as unknown as Array<Record<string, unknown>>;
  return rows[0] ? toLead(rows[0]) : null;
}

/** Counts per status, for the strip across the top of the screen. */
export async function leadCounts(): Promise<Record<LeadStatus, number> & { overdue: number; thisMonth: number }> {
  await ensureLeadsTable();
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT status, count(*)::int AS n FROM leads WHERE deleted_at IS NULL GROUP BY status
  `)) as unknown as Array<{ status: string; n: number }>;
  const extra = (await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE next_action_on < current_date AND status IN ('new','contacted','meeting','proposal'))::int AS overdue,
      count(*) FILTER (WHERE received_at >= date_trunc('month', now()) AND status <> 'spam')::int AS this_month
    FROM leads WHERE deleted_at IS NULL
  `)) as unknown as Array<{ overdue: number; this_month: number }>;

  const out = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const r of rows) if ((LEAD_STATUSES as readonly string[]).includes(r.status)) out[r.status as LeadStatus] = Number(r.n);
  return { ...out, overdue: Number(extra[0]?.overdue ?? 0), thisMonth: Number(extra[0]?.this_month ?? 0) };
}

export interface LeadUpdate {
  status?: LeadStatus;
  notes?: string | null;
  nextActionOn?: string | null;
  lostReason?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  firmSlug?: string | null;
  intakeToken?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  companyNumber?: string | null;
  services?: string | null;
}

/** Change a lead. Only the fields supplied are touched, as in handover-store. */
export async function updateLead(id: string, patch: LeadUpdate, updatedBy?: string): Promise<void> {
  await ensureLeadsTable();
  const db = getDb();
  const has = (k: keyof LeadUpdate) => patch[k] !== undefined;
  await db.execute(sql`
    UPDATE leads SET
      status         = CASE WHEN ${has("status")}        THEN ${patch.status ?? null}              ELSE status END,
      notes          = CASE WHEN ${has("notes")}         THEN ${patch.notes ?? null}               ELSE notes END,
      next_action_on = CASE WHEN ${has("nextActionOn")}  THEN ${patch.nextActionOn ?? null}::date  ELSE next_action_on END,
      lost_reason    = CASE WHEN ${has("lostReason")}    THEN ${patch.lostReason ?? null}          ELSE lost_reason END,
      owner_id       = CASE WHEN ${has("ownerId")}       THEN ${patch.ownerId ?? null}::uuid       ELSE owner_id END,
      owner_name     = CASE WHEN ${has("ownerName")}     THEN ${patch.ownerName ?? null}           ELSE owner_name END,
      firm_slug      = CASE WHEN ${has("firmSlug")}      THEN ${patch.firmSlug ?? null}            ELSE firm_slug END,
      intake_token   = CASE WHEN ${has("intakeToken")}   THEN ${patch.intakeToken ?? null}         ELSE intake_token END,
      name           = CASE WHEN ${has("name")}          THEN ${patch.name ?? null}                ELSE name END,
      email          = CASE WHEN ${has("email")}         THEN ${patch.email ?? null}               ELSE email END,
      phone          = CASE WHEN ${has("phone")}         THEN ${patch.phone ?? null}               ELSE phone END,
      company_name   = CASE WHEN ${has("companyName")}   THEN ${patch.companyName ?? null}         ELSE company_name END,
      company_number = CASE WHEN ${has("companyNumber")} THEN ${patch.companyNumber ?? null}       ELSE company_number END,
      services       = CASE WHEN ${has("services")}      THEN ${patch.services ?? null}            ELSE services END,
      updated_by     = COALESCE(${updatedBy ?? null}::uuid, updated_by),
      updated_at     = now()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
  `);
}
