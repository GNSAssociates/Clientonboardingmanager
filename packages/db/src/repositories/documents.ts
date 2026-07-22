import { and, desc, eq, isNull } from "drizzle-orm";
import type { Tx } from "../client";
import { documentClassifications, documents, documentVersions } from "../schema/documents";
import { checklistItems } from "../schema/cases";

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentVersionRow = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;
export type DocumentClassificationRow = typeof documentClassifications.$inferSelect;
export type NewDocumentClassification = typeof documentClassifications.$inferInsert;

/* ── documents ───────────────────────────────────────────────────────────── */
export async function insertDocument(tx: Tx, data: NewDocument): Promise<DocumentRow> {
  const [row] = await tx.insert(documents).values(data).returning();
  if (!row) throw new Error("document insert returned no row");
  return row;
}

export async function getDocumentById(tx: Tx, id: string): Promise<DocumentRow | undefined> {
  const [row] = await tx
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), isNull(documents.deletedAt)));
  return row;
}

export async function updateDocument(
  tx: Tx,
  id: string,
  patch: Partial<NewDocument>,
): Promise<DocumentRow> {
  const [row] = await tx
    .update(documents)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(documents.id, id))
    .returning();
  if (!row) throw new Error("document update returned no row");
  return row;
}

export function listDocumentsByCase(tx: Tx, caseId: string): Promise<DocumentRow[]> {
  return tx
    .select()
    .from(documents)
    .where(and(eq(documents.caseId, caseId), isNull(documents.deletedAt)))
    .orderBy(desc(documents.createdAt));
}

/* Link a document to a checklist item and mark the item as received. */
export async function linkDocumentToChecklist(
  tx: Tx,
  documentId: string,
  checklistItemId: string,
): Promise<void> {
  await tx
    .update(documents)
    .set({ checklistItemId, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
  await tx
    .update(checklistItems)
    .set({ documentId, status: "received", updatedAt: new Date() })
    .where(eq(checklistItems.id, checklistItemId));
}

/* ── document versions ───────────────────────────────────────────────────── */
export async function insertDocumentVersion(
  tx: Tx,
  data: NewDocumentVersion,
): Promise<DocumentVersionRow> {
  const [row] = await tx.insert(documentVersions).values(data).returning();
  if (!row) throw new Error("document_version insert returned no row");
  return row;
}

export function listVersionsByDocument(
  tx: Tx,
  documentId: string,
): Promise<DocumentVersionRow[]> {
  return tx
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber));
}

/* ── document classifications ────────────────────────────────────────────── */
export async function insertClassification(
  tx: Tx,
  data: NewDocumentClassification,
): Promise<DocumentClassificationRow> {
  const [row] = await tx.insert(documentClassifications).values(data).returning();
  if (!row) throw new Error("classification insert returned no row");
  return row;
}

export function listClassificationsByDocument(
  tx: Tx,
  documentId: string,
): Promise<DocumentClassificationRow[]> {
  return tx
    .select()
    .from(documentClassifications)
    .where(eq(documentClassifications.documentId, documentId))
    .orderBy(desc(documentClassifications.createdAt));
}

export async function confirmClassification(
  tx: Tx,
  classificationId: string,
  confirmedBy: string,
): Promise<DocumentClassificationRow> {
  const [row] = await tx
    .update(documentClassifications)
    .set({ confirmedBy, confirmedAt: new Date(), needsReview: false })
    .where(eq(documentClassifications.id, classificationId))
    .returning();
  if (!row) throw new Error("classification confirm returned no row");
  return row;
}
