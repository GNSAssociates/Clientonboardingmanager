import { and, eq } from "drizzle-orm";
import { clearanceFollowups, clearanceRequests } from "../schema/clearance";
import type { Tx } from "../client";

type NewRequest = typeof clearanceRequests.$inferInsert;
type NewFollowup = typeof clearanceFollowups.$inferInsert;

export async function insertClearanceRequest(tx: Tx, data: NewRequest) {
  const [row] = await tx.insert(clearanceRequests).values(data).returning();
  return row!;
}

export async function getClearanceRequestById(tx: Tx, id: string) {
  const [row] = await tx.select().from(clearanceRequests).where(eq(clearanceRequests.id, id));
  return row ?? null;
}

export async function getClearanceRequestByCaseId(tx: Tx, caseId: string) {
  const [row] = await tx
    .select()
    .from(clearanceRequests)
    .where(eq(clearanceRequests.caseId, caseId));
  return row ?? null;
}

export async function listClearanceRequestsByCase(tx: Tx, caseId: string) {
  return tx
    .select()
    .from(clearanceRequests)
    .where(eq(clearanceRequests.caseId, caseId))
    .orderBy(clearanceRequests.createdAt);
}

export async function updateClearanceRequest(
  tx: Tx,
  id: string,
  data: Partial<NewRequest>,
) {
  const [row] = await tx
    .update(clearanceRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clearanceRequests.id, id))
    .returning();
  return row ?? null;
}

export async function insertClearanceFollowup(tx: Tx, data: NewFollowup) {
  const [row] = await tx.insert(clearanceFollowups).values(data).returning();
  return row!;
}

export async function listFollowupsByRequest(tx: Tx, requestId: string) {
  return tx
    .select()
    .from(clearanceFollowups)
    .where(eq(clearanceFollowups.requestId, requestId))
    .orderBy(clearanceFollowups.sentAt);
}

export async function listFollowupsByCase(
  tx: Tx,
  caseId: string,
  entityId: string,
) {
  return tx
    .select()
    .from(clearanceFollowups)
    .where(
      and(
        eq(clearanceFollowups.caseId, caseId),
        eq(clearanceFollowups.entityId, entityId),
      ),
    )
    .orderBy(clearanceFollowups.sentAt);
}
