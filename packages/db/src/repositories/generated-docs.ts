import { and, desc, eq, isNull } from "drizzle-orm";
import type { Tx } from "../client";
import { esignEnvelopes, esignEvents, generatedDocuments } from "../schema/generated-docs";

export type GeneratedDocRow = typeof generatedDocuments.$inferSelect;
export type NewGeneratedDoc = typeof generatedDocuments.$inferInsert;
export type EsignEnvelopeRow = typeof esignEnvelopes.$inferSelect;
export type NewEsignEnvelope = typeof esignEnvelopes.$inferInsert;
export type NewEsignEvent = typeof esignEvents.$inferInsert;

/* ── generated documents ─────────────────────────────────────────────────── */
export async function insertGeneratedDoc(
  tx: Tx,
  data: NewGeneratedDoc,
): Promise<GeneratedDocRow> {
  const [row] = await tx.insert(generatedDocuments).values(data).returning();
  if (!row) throw new Error("generated_document insert returned no row");
  return row;
}

export async function getGeneratedDocById(
  tx: Tx,
  id: string,
): Promise<GeneratedDocRow | undefined> {
  const [row] = await tx
    .select()
    .from(generatedDocuments)
    .where(and(eq(generatedDocuments.id, id), isNull(generatedDocuments.deletedAt)));
  return row;
}

export function listGeneratedDocsByCase(tx: Tx, caseId: string): Promise<GeneratedDocRow[]> {
  return tx
    .select()
    .from(generatedDocuments)
    .where(and(eq(generatedDocuments.caseId, caseId), isNull(generatedDocuments.deletedAt)))
    .orderBy(desc(generatedDocuments.generatedAt));
}

export async function updateGeneratedDoc(
  tx: Tx,
  id: string,
  patch: Partial<NewGeneratedDoc>,
): Promise<GeneratedDocRow> {
  const [row] = await tx
    .update(generatedDocuments)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(generatedDocuments.id, id))
    .returning();
  if (!row) throw new Error("generated_document update returned no row");
  return row;
}

/* ── e-sign envelopes ────────────────────────────────────────────────────── */
export async function insertEnvelope(
  tx: Tx,
  data: NewEsignEnvelope,
): Promise<EsignEnvelopeRow> {
  const [row] = await tx.insert(esignEnvelopes).values(data).returning();
  if (!row) throw new Error("esign_envelope insert returned no row");
  return row;
}

export async function getEnvelopeById(
  tx: Tx,
  id: string,
): Promise<EsignEnvelopeRow | undefined> {
  const [row] = await tx
    .select()
    .from(esignEnvelopes)
    .where(eq(esignEnvelopes.id, id));
  return row;
}

export async function getEnvelopeByProviderRef(
  tx: Tx,
  providerRef: string,
): Promise<EsignEnvelopeRow | undefined> {
  const [row] = await tx
    .select()
    .from(esignEnvelopes)
    .where(eq(esignEnvelopes.providerRef, providerRef));
  return row;
}

export function listEnvelopesByCase(tx: Tx, caseId: string): Promise<EsignEnvelopeRow[]> {
  return tx
    .select()
    .from(esignEnvelopes)
    .where(eq(esignEnvelopes.caseId, caseId))
    .orderBy(desc(esignEnvelopes.createdAt));
}

export async function updateEnvelope(
  tx: Tx,
  id: string,
  patch: Partial<NewEsignEnvelope>,
): Promise<EsignEnvelopeRow> {
  const [row] = await tx
    .update(esignEnvelopes)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(esignEnvelopes.id, id))
    .returning();
  if (!row) throw new Error("esign_envelope update returned no row");
  return row;
}

/* ── e-sign events ───────────────────────────────────────────────────────── */
export async function insertEsignEvent(tx: Tx, data: NewEsignEvent): Promise<void> {
  await tx.insert(esignEvents).values(data);
}
