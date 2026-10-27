/**
 * Storing the handover checklist.
 *
 * The checklist_items table was created with the original design and never
 * used — nothing wrote to it, nothing read it, and the live database holds
 * zero rows. It is missing the things this practice actually needs: a note
 * against each item, who holds it, which period it must cover, and the chain
 * of people responsible.
 *
 * The columns are added with ALTER TABLE ... ADD COLUMN IF NOT EXISTS, run
 * once on first use. That is deliberate: the live database is Supabase and the
 * deploy path does not run migrations, so a feature that depends on a
 * migration someone has to remember is a feature that breaks on the day it
 * matters. Every statement here is safe to run repeatedly.
 *
 * THE CHAIN: each item is assigned to a member of staff, has an owner who the
 * work is reported to, and a partner it escalates to. That is what takes the
 * liaison off the partner's desk: the screen can say who is chasing what and
 * who to go to when it stalls, without anyone standing in the middle relaying.
 */
import { getDb } from "@gns/db";
import { sql } from "drizzle-orm";
import { buildChecklist, type ChecklistItem, type ClientFacts } from "./handover-checklist";

let ready: Promise<void> | null = null;

/** Add what the original table lacks. Safe to run as often as you like. */
export function ensureHandoverColumns(): Promise<void> {
  if (!ready) {
    const db = getDb();
    ready = (async () => {
      await db.execute(sql.raw(`
        ALTER TABLE checklist_items
          ADD COLUMN IF NOT EXISTS note          text,
          ADD COLUMN IF NOT EXISTS source        text,
          ADD COLUMN IF NOT EXISTS na_reason     text,
          ADD COLUMN IF NOT EXISTS hint          text,
          ADD COLUMN IF NOT EXISTS period_from   date,
          ADD COLUMN IF NOT EXISTS period_to     date,
          ADD COLUMN IF NOT EXISTS period_why    text,
          ADD COLUMN IF NOT EXISTS link_token    text,
          ADD COLUMN IF NOT EXISTS assigned_to   uuid,
          ADD COLUMN IF NOT EXISTS owner_id      uuid,
          ADD COLUMN IF NOT EXISTS partner_id    uuid,
          ADD COLUMN IF NOT EXISTS sort_order    integer DEFAULT 0,
          ADD COLUMN IF NOT EXISTS updated_by    uuid
      `));
      /* The original table requires an entity and a case; a handover starts
         from an onboarding LINK, which may exist before either. Relaxing the
         two constraints is what lets the checklist appear the moment an
         engagement is created, which is the whole point. */
      await db.execute(sql.raw(`ALTER TABLE checklist_items ALTER COLUMN entity_id DROP NOT NULL`)).catch(() => {});
      await db.execute(sql.raw(`ALTER TABLE checklist_items ALTER COLUMN case_id DROP NOT NULL`)).catch(() => {});
      await db.execute(sql.raw(
        `CREATE INDEX IF NOT EXISTS idx_checklist_link ON checklist_items (link_token, status)`,
      )).catch(() => {});
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export interface StoredItem {
  id: string;
  key: string;
  label: string;
  category: string;
  status: "pending" | "received" | "verified" | "na";
  source: string | null;
  note: string | null;
  naReason: string | null;
  hint: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  periodWhy: string | null;
  assignedTo: string | null;
  ownerId: string | null;
  partnerId: string | null;
  sortOrder: number;
}

const iso = (d?: Date) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * The checklist for one engagement, created on first look.
 *
 * Seeding on read rather than on creation means an engagement raised before
 * this existed still gets its checklist the first time someone opens it —
 * nobody has to go back and fix the old ones.
 */
export async function getOrCreateChecklist(
  linkToken: string,
  facts: ClientFacts,
): Promise<StoredItem[]> {
  await ensureHandoverColumns();
  const db = getDb();

  const existing = await readChecklist(linkToken);
  if (existing.length) return existing;

  const items = buildChecklist(facts);
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    await db.execute(sql`
      INSERT INTO checklist_items
        (key, label, category, required, status, responsible,
         source, na_reason, hint, period_from, period_to, period_why, link_token, sort_order)
      VALUES (
        ${it.key}, ${it.label}, ${it.category}, true,
        ${it.applies ? "pending" : "na"}::checklist_status,
        ${it.source === "client" ? "client" : "staff"}::responsible_party,
        ${it.source}, ${it.naReason ?? null}, ${it.hint ?? null},
        ${iso(it.period?.from)}, ${iso(it.period?.to)}, ${it.period?.why ?? null},
        ${linkToken}, ${i}
      )
    `);
  }
  return readChecklist(linkToken);
}

export async function readChecklist(linkToken: string): Promise<StoredItem[]> {
  await ensureHandoverColumns();
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT id, key, label, category, status, source, note, na_reason, hint,
           period_from, period_to, period_why, assigned_to, owner_id, partner_id,
           COALESCE(sort_order, 0) AS sort_order
    FROM checklist_items
    WHERE link_token = ${linkToken} AND deleted_at IS NULL
    ORDER BY COALESCE(sort_order, 0), key
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    key: String(r.key),
    label: String(r.label),
    category: String(r.category ?? "client"),
    status: String(r.status ?? "pending") as StoredItem["status"],
    source: (r.source as string) ?? null,
    note: (r.note as string) ?? null,
    naReason: (r.na_reason as string) ?? null,
    hint: (r.hint as string) ?? null,
    periodFrom: r.period_from ? String(r.period_from).slice(0, 10) : null,
    periodTo: r.period_to ? String(r.period_to).slice(0, 10) : null,
    periodWhy: (r.period_why as string) ?? null,
    assignedTo: (r.assigned_to as string) ?? null,
    ownerId: (r.owner_id as string) ?? null,
    partnerId: (r.partner_id as string) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
  }));
}

export interface ItemUpdate {
  status?: StoredItem["status"];
  note?: string | null;
  assignedTo?: string | null;
  ownerId?: string | null;
  partnerId?: string | null;
}

/**
 * Change one item. Only the fields actually supplied are touched, so two
 * people editing different things on the same row do not overwrite each other.
 *
 * Written as one parameterised statement: every value is bound, never
 * interpolated, because these rows carry client names and free-text notes.
 */
export async function updateItem(id: string, patch: ItemUpdate, updatedBy?: string): Promise<void> {
  await ensureHandoverColumns();
  const db = getDb();
  await db.execute(sql`
    UPDATE checklist_items SET
      status      = CASE WHEN ${patch.status !== undefined}      THEN ${patch.status ?? null}::checklist_status ELSE status END,
      note        = CASE WHEN ${patch.note !== undefined}        THEN ${patch.note ?? null}                    ELSE note END,
      assigned_to = CASE WHEN ${patch.assignedTo !== undefined}  THEN ${patch.assignedTo ?? null}::uuid        ELSE assigned_to END,
      owner_id    = CASE WHEN ${patch.ownerId !== undefined}     THEN ${patch.ownerId ?? null}::uuid           ELSE owner_id END,
      partner_id  = CASE WHEN ${patch.partnerId !== undefined}   THEN ${patch.partnerId ?? null}::uuid         ELSE partner_id END,
      updated_by  = COALESCE(${updatedBy ?? null}::uuid, updated_by),
      updated_at  = now()
    WHERE id = ${id}::uuid
  `);
}

/** Everything still outstanding, newest engagements first — Sagar's work list. */
export async function outstandingAcrossClients(limit = 200): Promise<Array<{
  linkToken: string; companyName: string | null; key: string; label: string;
  category: string; source: string | null; status: string; note: string | null;
  periodTo: string | null; assignedTo: string | null;
}>> {
  await ensureHandoverColumns();
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT ci.link_token, ol.company_name, ci.key, ci.label, ci.category,
           ci.source, ci.status, ci.note, ci.period_to, ci.assigned_to
    FROM checklist_items ci
    LEFT JOIN onboarding_links ol ON ol.token = ci.link_token
    WHERE ci.deleted_at IS NULL AND ci.status = 'pending' AND ci.link_token IS NOT NULL
    ORDER BY ol.created_at DESC NULLS LAST, ci.sort_order
    LIMIT ${limit}
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    linkToken: String(r.link_token),
    companyName: (r.company_name as string) ?? null,
    key: String(r.key),
    label: String(r.label),
    category: String(r.category ?? ""),
    source: (r.source as string) ?? null,
    status: String(r.status),
    note: (r.note as string) ?? null,
    periodTo: r.period_to ? String(r.period_to).slice(0, 10) : null,
    assignedTo: (r.assigned_to as string) ?? null,
  }));
}
