import { and, desc, eq } from "drizzle-orm";
import { integrationConnections, ledgerSnapshots } from "../schema/integrations";
import type { Tx } from "../client";

export type IntegrationConnectionRow = typeof integrationConnections.$inferSelect;
export type LedgerSnapshotRow = typeof ledgerSnapshots.$inferSelect;

// ── integration_connections ───────────────────────────────────────────────────

export async function upsertIntegrationConnection(
  tx: Tx,
  data: typeof integrationConnections.$inferInsert,
): Promise<IntegrationConnectionRow> {
  const [row] = await tx
    .insert(integrationConnections)
    .values(data)
    .onConflictDoUpdate({
      target: [integrationConnections.clientId, integrationConnections.provider],
      set: {
        status: data.status,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        tenantId: data.tenantId,
        tenantName: data.tenantName,
        scopes: data.scopes,
        lastSyncAt: data.lastSyncAt,
        errorMessage: data.errorMessage,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function getConnectionById(tx: Tx, id: string) {
  const [row] = await tx
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, id));
  return row ?? null;
}

export async function getConnectionByClientAndProvider(
  tx: Tx,
  clientId: string,
  provider: "xero" | "qbo",
) {
  const [row] = await tx
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.clientId, clientId),
        eq(integrationConnections.provider, provider),
      ),
    );
  return row ?? null;
}

export async function listConnectionsByClient(tx: Tx, clientId: string) {
  return tx
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.clientId, clientId));
}

export async function updateConnectionStatus(
  tx: Tx,
  id: string,
  status: IntegrationConnectionRow["status"],
  errorMessage?: string,
) {
  await tx
    .update(integrationConnections)
    .set({ status, errorMessage: errorMessage ?? null, updatedAt: new Date() })
    .where(eq(integrationConnections.id, id));
}

// ── ledger_snapshots ──────────────────────────────────────────────────────────

export async function insertLedgerSnapshot(
  tx: Tx,
  data: typeof ledgerSnapshots.$inferInsert,
): Promise<LedgerSnapshotRow> {
  const [row] = await tx.insert(ledgerSnapshots).values(data).returning();
  return row!;
}

export async function getLatestSnapshot(
  tx: Tx,
  clientId: string,
  kind: LedgerSnapshotRow["kind"],
) {
  const [row] = await tx
    .select()
    .from(ledgerSnapshots)
    .where(
      and(eq(ledgerSnapshots.clientId, clientId), eq(ledgerSnapshots.kind, kind)),
    )
    .orderBy(desc(ledgerSnapshots.pulledAt))
    .limit(1);
  return row ?? null;
}

export async function listSnapshotsByCase(tx: Tx, caseId: string) {
  return tx
    .select()
    .from(ledgerSnapshots)
    .where(eq(ledgerSnapshots.caseId, caseId))
    .orderBy(desc(ledgerSnapshots.pulledAt));
}
