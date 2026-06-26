import { and, desc, eq } from "drizzle-orm";
import { reviewFindings, reviewTasks } from "../schema/reviews";
import type { Tx } from "../client";

export type ReviewTaskRow = typeof reviewTasks.$inferSelect;
export type ReviewFindingRow = typeof reviewFindings.$inferSelect;

export async function insertReviewTask(tx: Tx, data: typeof reviewTasks.$inferInsert) {
  const [row] = await tx.insert(reviewTasks).values(data).returning();
  return row!;
}

export async function getReviewTaskById(tx: Tx, id: string) {
  const [row] = await tx.select().from(reviewTasks).where(eq(reviewTasks.id, id));
  return row ?? null;
}

export async function listReviewTasksByCase(tx: Tx, caseId: string) {
  return tx
    .select()
    .from(reviewTasks)
    .where(eq(reviewTasks.caseId, caseId))
    .orderBy(reviewTasks.reviewType);
}

export async function updateReviewTask(tx: Tx, id: string, data: Partial<typeof reviewTasks.$inferInsert>) {
  const [row] = await tx
    .update(reviewTasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(reviewTasks.id, id))
    .returning();
  return row ?? null;
}

export async function insertReviewFinding(tx: Tx, data: typeof reviewFindings.$inferInsert) {
  const [row] = await tx.insert(reviewFindings).values(data).returning();
  return row!;
}

export async function listFindingsByReview(tx: Tx, reviewTaskId: string) {
  return tx
    .select()
    .from(reviewFindings)
    .where(eq(reviewFindings.reviewTaskId, reviewTaskId))
    .orderBy(desc(reviewFindings.severity));
}

export async function resolveReviewFinding(
  tx: Tx,
  id: string,
  resolvedBy: string,
  notes?: string,
) {
  const [row] = await tx
    .update(reviewFindings)
    .set({ resolvedAt: new Date(), resolvedBy, resolutionNotes: notes })
    .where(eq(reviewFindings.id, id))
    .returning();
  return row ?? null;
}
