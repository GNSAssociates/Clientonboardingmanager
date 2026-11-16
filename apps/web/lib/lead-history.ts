/**
 * Everything that has happened with a lead, in one timeline:
 *
 *  - emails between the lead and ANY GNS mailbox: info@ and every staff
 *    member's, both directions, with attachments, quotes flagged;
 *  - emails the platform sent itself (from the email log);
 *  - contact logged by hand: WhatsApp, phone calls, meetings, texts;
 *  - changes made on the lead: stage, owner, follow-up date, notes.
 *
 * MAILBOX ACCESS. Reading mail uses the same Entra app the platform already
 * sends mail with, and needs the Microsoft Graph application permission
 * Mail.Read with admin consent. Until it is granted, the timeline still shows
 * everything else and says plainly that mailbox access is missing. Mail.Read
 * on its own covers every mailbox in the tenant; an Exchange application
 * access policy should restrict it to the GNS staff group (see
 * docs/leads-email-history.md).
 *
 * Which mailboxes: info@ (MAIL_FROM_EMAIL), anything in LEADS_MAILBOXES
 * (comma-separated, e.g. a shared quotes@), and every active staff account in
 * the app whose address is on one of LEADS_MAIL_DOMAINS (default
 * gnsassociates.co.uk,gnsuk.com). New staff are included the day they are added.
 */
import "server-only";
import { getDb } from "@gns/db";
import { sql } from "drizzle-orm";
import { getGraphToken } from "./onedrive";
import { ensureLeadsTable } from "./lead-store";
import {
  mergeMailboxResults, addAppSent, searchableEmail, domainOf,
  type GraphMessage, type LeadEmail,
} from "./lead-mail-match";

/* ------------------------------------------------------------------ */
/* Activity: changes and hand-logged contact                           */
/* ------------------------------------------------------------------ */

export const CONTACT_CHANNELS = ["whatsapp", "phone", "meeting", "sms", "email", "other"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export interface LeadEvent {
  id: string;
  at: string;
  actorName: string | null;
  kind: "created" | "status" | "owner" | "next_action" | "notes" | "firm" | "intake" | "contact" | "auto" | "draft";
  /** For kind = contact. */
  channel?: ContactChannel;
  direction?: "in" | "out";
  text: string;
}

let ready: Promise<void> | null = null;

export function ensureLeadEventsTable(): Promise<void> {
  if (!ready) {
    const db = getDb();
    ready = (async () => {
      await ensureLeadsTable();
      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS lead_events (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_id     uuid NOT NULL,
          at          timestamptz NOT NULL DEFAULT now(),
          actor_id    uuid,
          actor_name  text,
          kind        text NOT NULL,
          channel     text,
          direction   text,
          text        text NOT NULL DEFAULT '',
          deleted_at  timestamptz
        )
      `));
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events (lead_id, at DESC)`));
      /* When the lead was last written to and last heard from, across email
         and logged contact: what the list shows, without searching mailboxes
         for every row. */
      await db.execute(sql.raw(`
        ALTER TABLE leads
          ADD COLUMN IF NOT EXISTS last_out_at timestamptz,
          ADD COLUMN IF NOT EXISTS last_in_at  timestamptz
      `));
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function logLeadEvent(e: {
  leadId: string;
  kind: LeadEvent["kind"];
  text: string;
  actorId?: string | null;
  actorName?: string | null;
  channel?: ContactChannel;
  direction?: "in" | "out";
  at?: string;
}): Promise<void> {
  await ensureLeadEventsTable();
  const db = getDb();
  await db.execute(sql`
    INSERT INTO lead_events (lead_id, at, actor_id, actor_name, kind, channel, direction, text)
    VALUES (${e.leadId}::uuid, COALESCE(${e.at ?? null}::timestamptz, now()), ${e.actorId ?? null}::uuid,
            ${e.actorName ?? null}, ${e.kind}, ${e.channel ?? null}, ${e.direction ?? null}, ${e.text.slice(0, 5000)})
  `);
  if (e.kind === "contact" && e.direction) await touchLastContact(e.leadId, e.direction, e.at ?? new Date().toISOString());
}

/** Keep the lead's last-contact dates moving forward only. */
export async function touchLastContact(leadId: string, direction: "in" | "out", at: string): Promise<void> {
  await ensureLeadEventsTable();
  const db = getDb();
  if (direction === "out") {
    await db.execute(sql`UPDATE leads SET last_out_at = GREATEST(coalesce(last_out_at, '-infinity'), ${at}::timestamptz) WHERE id = ${leadId}::uuid`);
  } else {
    await db.execute(sql`UPDATE leads SET last_in_at  = GREATEST(coalesce(last_in_at,  '-infinity'), ${at}::timestamptz) WHERE id = ${leadId}::uuid`);
  }
}

export async function listLeadEvents(leadId: string): Promise<LeadEvent[]> {
  await ensureLeadEventsTable();
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT id, at, actor_name, kind, channel, direction, text
    FROM lead_events WHERE lead_id = ${leadId}::uuid AND deleted_at IS NULL
    ORDER BY at DESC LIMIT 500
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    at: new Date(String(r.at)).toISOString(),
    actorName: (r.actor_name as string) ?? null,
    kind: String(r.kind) as LeadEvent["kind"],
    channel: (r.channel as ContactChannel) ?? undefined,
    direction: (r.direction as "in" | "out") ?? undefined,
    text: String(r.text ?? ""),
  }));
}

/** Remove a hand-logged contact note typed in error. Only contact notes can go. */
export async function deleteContactEvent(leadId: string, eventId: string): Promise<boolean> {
  await ensureLeadEventsTable();
  const db = getDb();
  const rows = (await db.execute(sql`
    UPDATE lead_events SET deleted_at = now()
    WHERE id = ${eventId}::uuid AND lead_id = ${leadId}::uuid AND kind = 'contact' AND deleted_at IS NULL
    RETURNING id
  `)) as unknown as Array<{ id: string }>;
  return rows.length > 0;
}

/* ------------------------------------------------------------------ */
/* Email: every GNS mailbox                                             */
/* ------------------------------------------------------------------ */

export type MailAccess = "ok" | "not_configured" | "not_granted" | "partial" | "error";

export interface MailHistory {
  emails: LeadEmail[];
  access: MailAccess;
  mailboxesSearched: number;
  /** Mailboxes Graph refused or does not know, for the diagnostics line. */
  skipped: string[];
  searchedFor: string | null;
}

function ourDomains(): string[] {
  const list = (process.env.LEADS_MAIL_DOMAINS ?? "gnsassociates.co.uk,gnsuk.com")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  // The sending mailbox's domain is always ours.
  const sender = (process.env.MAIL_FROM_EMAIL ?? "info@gnsassociates.co.uk").toLowerCase();
  const d = domainOf(sender);
  return list.includes(d) ? list : [...list, d];
}

/** info@, any extra shared mailboxes, and every active staff account on our domains. */
export async function leadMailboxes(): Promise<string[]> {
  const domains = ourDomains();
  const fixed = [
    process.env.MAIL_FROM_EMAIL ?? "info@gnsassociates.co.uk",
    ...(process.env.LEADS_MAILBOXES ?? "").split(","),
  ].map((s) => s.trim().toLowerCase()).filter(Boolean);

  let staff: string[] = [];
  try {
    const rows = (await getDb().execute(sql`
      SELECT lower(email) AS email FROM users
      WHERE deleted_at IS NULL AND status = 'active'
    `)) as unknown as Array<{ email: string }>;
    staff = rows.map((r) => r.email).filter((e) => domains.includes(domainOf(e)));
  } catch (e) {
    console.error("lead mailboxes: could not read staff list:", e);
  }
  return [...new Set([...fixed, ...staff])];
}

const cache = new Map<string, { at: number; value: MailHistory }>();
const CACHE_MS = 2 * 60 * 1000;

/** Run at most `n` requests at once: a dozen mailboxes, not a dozen at a time. */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]!); }
  }));
  return out;
}

async function graphGet(url: string, token: string): Promise<{ status: number; json: any }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/**
 * Every email between `leadEmail` and any GNS mailbox, newest first.
 * Cached for two minutes per address; `fresh` skips the cache.
 */
export async function leadEmailHistory(leadEmail: string | null, opts: { fresh?: boolean } = {}): Promise<MailHistory> {
  const email = searchableEmail(leadEmail);
  if (!email) return { emails: [], access: "ok", mailboxesSearched: 0, skipped: [], searchedFor: null };

  const hit = cache.get(email);
  if (!opts.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const token = await getGraphToken();
  if (!token) return { emails: [], access: "not_configured", mailboxesSearched: 0, skipped: [], searchedFor: email };

  const mailboxes = await leadMailboxes();
  const domains = ourDomains();
  const select = "id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,webLink,hasAttachments,isDraft";
  // $search over /messages covers every folder: inbox, Sent Items, archive, subfolders.
  const search = encodeURIComponent(`"participants:${email}"`);

  const results = await pool(mailboxes, 5, async (mb) => {
    try {
      const r = await graphGet(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mb)}/messages?$search=${search}&$top=50&$select=${select}`,
        token,
      );
      if (r.status === 200) return { mb, status: 200, messages: (r.json.value ?? []) as GraphMessage[] };
      return { mb, status: r.status, messages: [] as GraphMessage[] };
    } catch {
      return { mb, status: 0, messages: [] as GraphMessage[] };
    }
  });

  const found: Array<{ mailbox: string; message: GraphMessage; attachments?: string[] }> = [];
  for (const r of results) for (const m of r.messages) found.push({ mailbox: r.mb, message: m });

  // Attachment names, so a quote sent as "GNS fee proposal.pdf" is recognised.
  // Only for the most recent messages that have any, to keep this quick.
  const withFiles = found.filter((f) => f.message.hasAttachments && !f.message.isDraft)
    .sort((a, b) => String(b.message.sentDateTime ?? "").localeCompare(String(a.message.sentDateTime ?? "")))
    .slice(0, 15);
  await pool(withFiles, 5, async (f) => {
    try {
      const r = await graphGet(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(f.mailbox)}/messages/${encodeURIComponent(f.message.id)}/attachments?$select=name,isInline`,
        token,
      );
      if (r.status === 200) {
        f.attachments = (r.json.value ?? [])
          .filter((a: { isInline?: boolean }) => !a.isInline)
          .map((a: { name?: string }) => String(a.name ?? "")).filter(Boolean);
      }
    } catch { /* names are a nicety; the email still shows */ }
  });

  let emails = mergeMailboxResults(found, domains);

  // What the platform sent itself.
  try {
    const rows = (await getDb().execute(sql`
      SELECT subject, sent_at, template_key FROM email_log
      WHERE lower(to_email) = ${email} AND success = true
      ORDER BY sent_at DESC LIMIT 50
    `)) as unknown as Array<{ subject: string; sent_at: string; template_key: string }>;
    emails = addAppSent(
      emails,
      rows.map((r) => ({ subject: r.subject, sentAt: new Date(String(r.sent_at)).toISOString(), template: r.template_key })),
      process.env.MAIL_FROM_EMAIL ?? "info@gnsassociates.co.uk",
    );
  } catch { /* the email log is optional */ }

  const ok = results.filter((r) => r.status === 200).length;
  const denied = results.filter((r) => r.status === 401 || r.status === 403).length;
  const access: MailAccess =
    ok === results.length ? "ok"
      : ok === 0 && denied > 0 ? "not_granted"
        : ok === 0 ? "error"
          : "partial";

  const value: MailHistory = {
    emails,
    access,
    mailboxesSearched: ok,
    // 404 = a staff login with no Microsoft 365 mailbox; not worth alarming anyone about.
    skipped: results.filter((r) => r.status !== 200 && r.status !== 404).map((r) => r.mb),
    searchedFor: email,
  };
  cache.set(email, { at: Date.now(), value });
  return value;
}

/**
 * After the emails are known: record the last contact dates, and move a New
 * lead to Contacted once someone at GNS has written to them. A partner who
 * replied straight from Outlook should not also have to click "Contacted".
 */
export async function applyEmailFacts(
  lead: { id: string; status: string; receivedAt: string },
  emails: LeadEmail[],
): Promise<{ autoContacted: LeadEmail | null }> {
  const lastOut = emails.find((e) => e.direction === "out");
  const lastIn = emails.find((e) => e.direction === "in");
  if (lastOut) await touchLastContact(lead.id, "out", lastOut.at);
  if (lastIn) await touchLastContact(lead.id, "in", lastIn.at);

  if (lead.status !== "new") return { autoContacted: null };
  const reply = [...emails].reverse().find((e) => e.direction === "out" && e.at >= lead.receivedAt);
  if (!reply) return { autoContacted: null };

  const db = getDb();
  const rows = (await db.execute(sql`
    UPDATE leads SET status = 'contacted', updated_at = now()
    WHERE id = ${lead.id}::uuid AND status = 'new' RETURNING id
  `)) as unknown as Array<{ id: string }>;
  if (rows.length) {
    await logLeadEvent({
      leadId: lead.id,
      kind: "auto",
      at: reply.at,
      text: `Moved to Contacted: ${reply.fromName ?? reply.fromAddress ?? "GNS"} replied by email ("${reply.subject}").`,
    });
  }
  return { autoContacted: rows.length ? reply : null };
}
