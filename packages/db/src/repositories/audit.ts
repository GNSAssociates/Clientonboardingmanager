import type { Tx } from "../client";
import { auditLogs } from "../schema/platform";

/**
 * Audit data access (A3 §6, NFR-AUD-1). Insert-only — the table is append-only
 * (no update/delete policy or grant). Called within the same transaction as the
 * mutation it records, so the audit row and the change commit atomically.
 */
export type NewAudit = typeof auditLogs.$inferInsert;

export async function insertAudit(tx: Tx, row: NewAudit): Promise<void> {
  await tx.insert(auditLogs).values(row);
}
