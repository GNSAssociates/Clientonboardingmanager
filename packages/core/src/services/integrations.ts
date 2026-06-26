import { z } from "zod";
import {
  getDb,
  upsertIntegrationConnection,
  getConnectionById,
  getConnectionByClientAndProvider,
  listConnectionsByClient,
  updateConnectionStatus,
  insertLedgerSnapshot,
  getLatestSnapshot,
  listSnapshotsByCase,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { authorize } from "../rbac";
import type { LedgerPort } from "../ports";

// ── Schemas ───────────────────────────────────────────────────────────────────

export const ConnectIntegrationInput = z.object({
  entityId: z.string().uuid(),
  clientId: z.string().uuid(),
  provider: z.enum(["xero", "qbo"]),
  code: z.string().min(1),
  state: z.string().optional(),
});

export const PullLedgerInput = z.object({
  entityId: z.string().uuid(),
  clientId: z.string().uuid(),
  caseId: z.string().uuid().optional(),
  connectionId: z.string().uuid(),
  kind: z.enum(["trial_balance", "ledgers", "vat", "payroll", "coa"]),
  period: z.string().optional(),
});

// ── Service functions ─────────────────────────────────────────────────────────

export async function getIntegrationAuthUrl(
  session: AuthSession,
  provider: "xero" | "qbo",
  ledgerAdapter: LedgerPort,
): Promise<{ url: string }> {
  authorize(session, "create_case");
  const state = `${session.userId}:${provider}:${Date.now()}`;
  const url = ledgerAdapter.getAuthUrl(state);
  return { url };
}

export async function connectIntegration(
  session: AuthSession,
  input: z.infer<typeof ConnectIntegrationInput>,
  ledgerAdapter: LedgerPort,
): Promise<{ connectionId: string }> {
  authorize(session, "create_case");
  const parsed = ConnectIntegrationInput.parse(input);

  const tokens = await ledgerAdapter.exchangeCode(parsed.code);

  return getDb().transaction(async (tx) => {
    const connection = await upsertIntegrationConnection(tx, {
      entityId: parsed.entityId,
      clientId: parsed.clientId,
      provider: parsed.provider,
      status: "connected",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      connectedBy: session.userId,
      lastSyncAt: new Date(),
    });
    return { connectionId: connection.id };
  });
}

export async function disconnectIntegration(
  session: AuthSession,
  connectionId: string,
): Promise<void> {
  authorize(session, "create_case");
  await getDb().transaction(async (tx) => {
    await updateConnectionStatus(tx, connectionId, "revoked");
  });
}

export async function pullLedgerSnapshot(
  session: AuthSession,
  input: z.infer<typeof PullLedgerInput>,
  ledgerAdapter: LedgerPort,
): Promise<{ snapshotId: string; payload: Record<string, unknown> }> {
  authorize(session, "conduct_review");
  const parsed = PullLedgerInput.parse(input);

  const connection = await getDb().transaction((tx) =>
    getConnectionById(tx, parsed.connectionId),
  );
  if (!connection || connection.status !== "connected") {
    throw new Error("Integration not connected");
  }

  const snapshot = await ledgerAdapter.pull(parsed.kind, parsed.connectionId);

  return getDb().transaction(async (tx) => {
    const row = await insertLedgerSnapshot(tx, {
      entityId: parsed.entityId,
      clientId: parsed.clientId,
      caseId: parsed.caseId,
      connectionId: parsed.connectionId,
      provider: connection.provider,
      kind: parsed.kind,
      period: parsed.period ?? snapshot.period,
      payload: snapshot.payload,
    });
    return { snapshotId: row.id, payload: snapshot.payload as Record<string, unknown> };
  });
}

export async function getIntegrationSummary(
  session: AuthSession,
  clientId: string,
  caseId?: string,
) {
  authorize(session, "view_assigned_cases");
  return getDb().transaction(async (tx) => {
    const connections = await listConnectionsByClient(tx, clientId);
    const snapshots = caseId ? await listSnapshotsByCase(tx, caseId) : [];
    return { connections, snapshots };
  });
}
