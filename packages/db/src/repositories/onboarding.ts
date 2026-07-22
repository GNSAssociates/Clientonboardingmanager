import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, type Tx } from "../client";
import { clientContacts, clients } from "../schema/clients";
import { caseTransitions, checklistItems, onboardingCases } from "../schema/cases";
import { clientServices, pricingAgreements, services } from "../schema/services";
import { tasks } from "../schema/tasks";
import { events } from "../schema/platform";

/* Inferred row/insert types */
export type ClientRow = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type NewClientContact = typeof clientContacts.$inferInsert;
export type CaseRow = typeof onboardingCases.$inferSelect;
export type NewCase = typeof onboardingCases.$inferInsert;
export type ChecklistRow = typeof checklistItems.$inferSelect;
export type NewChecklistItem = typeof checklistItems.$inferInsert;
export type ServiceRow = typeof services.$inferSelect;
export type NewClientService = typeof clientServices.$inferInsert;
export type NewPricing = typeof pricingAgreements.$inferInsert;
export type PricingRow = typeof pricingAgreements.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventRow = typeof events.$inferSelect;

/* ── clients ─────────────────────────────────────────────────────────────── */
export async function insertClient(tx: Tx, data: NewClient): Promise<ClientRow> {
  const [row] = await tx.insert(clients).values(data).returning();
  if (!row) throw new Error("client insert returned no row");
  return row;
}

export async function getClientById(tx: Tx, id: string): Promise<ClientRow | undefined> {
  const [row] = await tx
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), isNull(clients.deletedAt)));
  return row;
}

export async function insertClientContact(tx: Tx, data: NewClientContact): Promise<void> {
  await tx.insert(clientContacts).values(data);
}

/* ── cases ───────────────────────────────────────────────────────────────── */
export async function insertCase(tx: Tx, data: NewCase): Promise<CaseRow> {
  const [row] = await tx.insert(onboardingCases).values(data).returning();
  if (!row) throw new Error("case insert returned no row");
  return row;
}

export async function getCaseById(tx: Tx, id: string): Promise<CaseRow | undefined> {
  const [row] = await tx
    .select()
    .from(onboardingCases)
    .where(and(eq(onboardingCases.id, id), isNull(onboardingCases.deletedAt)));
  return row;
}

export interface CaseListOpts {
  entityIds?: string[]; // undefined = no entity filter (admin)
  status?: CaseRow["status"];
  assignedTo?: string;
}

export function listCases(tx: Tx, opts: CaseListOpts): Promise<CaseRow[]> {
  const conds = [isNull(onboardingCases.deletedAt)];
  if (opts.entityIds && opts.entityIds.length > 0) {
    conds.push(inArray(onboardingCases.entityId, opts.entityIds));
  }
  if (opts.status) conds.push(eq(onboardingCases.status, opts.status));
  if (opts.assignedTo) conds.push(eq(onboardingCases.assignedTo, opts.assignedTo));
  return tx
    .select()
    .from(onboardingCases)
    .where(and(...conds))
    .orderBy(desc(onboardingCases.createdAt))
    .limit(200);
}

export async function setCaseStatus(
  tx: Tx,
  id: string,
  status: CaseRow["status"],
  patch: Partial<NewCase> = {},
): Promise<CaseRow> {
  const [row] = await tx
    .update(onboardingCases)
    .set({ status, ...patch, updatedAt: new Date() })
    .where(eq(onboardingCases.id, id))
    .returning();
  if (!row) throw new Error("case update returned no row");
  return row;
}

export async function insertTransition(
  tx: Tx,
  data: typeof caseTransitions.$inferInsert,
): Promise<void> {
  await tx.insert(caseTransitions).values(data);
}

export async function countCasesForEntity(tx: Tx, entityId: string): Promise<number> {
  const [row] = await tx
    .select({ c: sql<number>`count(*)::int` })
    .from(onboardingCases)
    .where(eq(onboardingCases.entityId, entityId));
  return row?.c ?? 0;
}

/* ── checklist ───────────────────────────────────────────────────────────── */
export async function insertChecklistItems(tx: Tx, rows: NewChecklistItem[]): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(checklistItems).values(rows);
}

export function listChecklist(tx: Tx, caseId: string): Promise<ChecklistRow[]> {
  return tx
    .select()
    .from(checklistItems)
    .where(and(eq(checklistItems.caseId, caseId), isNull(checklistItems.deletedAt)));
}

/* ── services / pricing ──────────────────────────────────────────────────── */
export function listActiveServices(tx: Tx): Promise<ServiceRow[]> {
  return tx
    .select()
    .from(services)
    .where(and(eq(services.isActive, true), isNull(services.deletedAt)));
}

export function getServicesByIds(tx: Tx, ids: string[]): Promise<ServiceRow[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return tx.select().from(services).where(inArray(services.id, ids));
}

export async function insertClientServices(tx: Tx, rows: NewClientService[]): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(clientServices).values(rows).onConflictDoNothing();
}

export function listClientServices(tx: Tx, caseId: string) {
  return tx
    .select()
    .from(clientServices)
    .where(and(eq(clientServices.caseId, caseId), isNull(clientServices.deletedAt)));
}

export async function insertPricingAgreement(tx: Tx, data: NewPricing): Promise<PricingRow> {
  const [row] = await tx.insert(pricingAgreements).values(data).returning();
  if (!row) throw new Error("pricing insert returned no row");
  return row;
}

/* ── tasks ───────────────────────────────────────────────────────────────── */
export async function insertTasks(tx: Tx, rows: NewTask[]): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(tasks).values(rows);
}

export function listTasks(tx: Tx, opts: { entityIds?: string[]; assignedTo?: string }) {
  const conds = [isNull(tasks.deletedAt)];
  if (opts.entityIds && opts.entityIds.length > 0) conds.push(inArray(tasks.entityId, opts.entityIds));
  if (opts.assignedTo) conds.push(eq(tasks.assignedTo, opts.assignedTo));
  return tx
    .select()
    .from(tasks)
    .where(and(...conds))
    .orderBy(desc(tasks.createdAt))
    .limit(200);
}

/* ── outbox events ───────────────────────────────────────────────────────── */
export async function insertEvent(tx: Tx, data: NewEvent): Promise<void> {
  await tx.insert(events).values(data).onConflictDoNothing({ target: events.idempotencyKey });
}

/** Dispatcher reads (unscoped — runs as a service worker). */
export function listPendingEvents(limit = 50): Promise<EventRow[]> {
  return getDb()
    .select()
    .from(events)
    .where(eq(events.status, "pending"))
    .orderBy(events.availableAt)
    .limit(limit);
}

export async function markEventDispatched(id: string): Promise<void> {
  await getDb()
    .update(events)
    .set({ status: "dispatched", dispatchedAt: new Date(), updatedAt: new Date() })
    .where(eq(events.id, id));
}
