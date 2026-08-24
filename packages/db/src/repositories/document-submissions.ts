import { and, eq, sql } from "drizzle-orm";
import { documentSubmissions } from "../schema/document-submissions";
import type { Tx } from "../client";

export type DocumentSubmissionRow = typeof documentSubmissions.$inferSelect;


/**
 * Create the table if it is missing, then continue.
 *
 * Migrations are NOT run automatically on this deployment (the database lives on
 * the cPanel host and CI cannot reach it), so a table added in a later migration
 * can be absent on the live database. When that happened for this table, every
 * query threw and the client-facing document portal showed "link is invalid or
 * has expired" — the director could never upload their ID.
 *
 * This mirrors migrations/0022_document_submissions.sql exactly and is safe to
 * run on every request: IF NOT EXISTS makes it a no-op once the table is there.
 */
export async function ensureDocumentSubmissionsTable(tx: Tx): Promise<void> {
  await tx.execute(sql`
    CREATE TABLE IF NOT EXISTS document_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      onboarding_token TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      doc_label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      file_name TEXT,
      file_url TEXT,
      file_size_bytes INTEGER,
      mime_type TEXT,
      uploaded_at TIMESTAMPTZ,
      follow_up_count INTEGER NOT NULL DEFAULT 0,
      last_follow_up_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS doc_sub_token_idx ON document_submissions(onboarding_token)`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS doc_sub_type_idx ON document_submissions(doc_type)`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS doc_sub_status_idx ON document_submissions(status)`);
}

export async function initDocumentSubmissions(
  tx: Tx,
  onboardingToken: string,
  docTypes: Array<{ id: string; label: string }>,
): Promise<DocumentSubmissionRow[]> {
  await ensureDocumentSubmissionsTable(tx);

  // Insert pending rows only for doc types that don't already exist
  const existing = await tx
    .select()
    .from(documentSubmissions)
    .where(eq(documentSubmissions.onboardingToken, onboardingToken));

  const existingIds = new Set(existing.map((r) => r.docType));
  const toInsert = docTypes.filter((d) => !existingIds.has(d.id));

  if (toInsert.length === 0) return existing;

  await tx.insert(documentSubmissions).values(
    toInsert.map((d) => ({
      onboardingToken,
      docType: d.id,
      docLabel: d.label,
      status: "pending" as const,
    })),
  );

  return tx
    .select()
    .from(documentSubmissions)
    .where(eq(documentSubmissions.onboardingToken, onboardingToken));
}

export async function getDocumentSubmissions(tx: Tx, onboardingToken: string) {
  return tx
    .select()
    .from(documentSubmissions)
    .where(eq(documentSubmissions.onboardingToken, onboardingToken));
}

export async function upsertDocumentSubmission(
  tx: Tx,
  onboardingToken: string,
  docType: string,
  docLabel: string,
  data: {
    fileName: string;
    fileUrl: string;
    fileSizeBytes: number;
    mimeType: string;
  },
): Promise<DocumentSubmissionRow> {
  const existing = await tx
    .select()
    .from(documentSubmissions)
    .where(
      and(
        eq(documentSubmissions.onboardingToken, onboardingToken),
        eq(documentSubmissions.docType, docType),
      ),
    );

  if (existing.length > 0) {
  // self-heal (upsert): the table may be missing on a database that never ran
  // migration 0022 — creating it here keeps client uploads working.
  await ensureDocumentSubmissionsTable(tx);

    const [updated] = await tx
      .update(documentSubmissions)
      .set({
        ...data,
        docLabel,
        status: "uploaded",
        uploadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentSubmissions.id, existing[0]!.id))
      .returning();
    return updated!;
  }

  const [inserted] = await tx
    .insert(documentSubmissions)
    .values({
      onboardingToken,
      docType,
      docLabel,
      ...data,
      status: "uploaded",
      uploadedAt: new Date(),
    })
    .returning();
  return inserted!;
}

export async function removeDocumentSubmission(
  tx: Tx,
  onboardingToken: string,
  docType: string,
) {
  await tx
    .update(documentSubmissions)
    .set({ status: "pending", fileName: null, fileUrl: null, fileSizeBytes: null, mimeType: null, uploadedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(documentSubmissions.onboardingToken, onboardingToken),
        eq(documentSubmissions.docType, docType),
      ),
    );
}

export async function getDocumentCompletionStatus(tx: Tx, onboardingToken: string, requiredDocIds: string[]) {
  const rows = await getDocumentSubmissions(tx, onboardingToken);
  const uploadedIds = rows.filter((r) => r.status === "uploaded").map((r) => r.docType);
  const missingRequired = requiredDocIds.filter((id) => !uploadedIds.includes(id));
  return {
    total: requiredDocIds.length,
    uploaded: uploadedIds.length,
    missingRequired,
    isComplete: missingRequired.length === 0,
    rows,
  };
}

export async function incrementDocFollowUp(tx: Tx, onboardingToken: string) {
  // We track follow-up count on the first pending required doc row as a proxy
  const rows = await tx
    .select()
    .from(documentSubmissions)
    .where(
      and(
        eq(documentSubmissions.onboardingToken, onboardingToken),
        eq(documentSubmissions.status, "pending"),
      ),
    );
  if (rows.length === 0) return;
  const count = (rows[0]!.followUpCount ?? 0) + 1;
  await tx
    .update(documentSubmissions)
    .set({ followUpCount: count, lastFollowUpAt: new Date(), updatedAt: new Date() })
    .where(eq(documentSubmissions.onboardingToken, onboardingToken));
}
