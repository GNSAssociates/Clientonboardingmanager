import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { integrationProviderEnum, integrationStatusEnum, ledgerSnapshotKindEnum } from "./enums";
import { entities } from "./tenancy";
import { clients } from "./clients";
import { onboardingCases } from "./cases";

// ── integration_connections ───────────────────────────────────────────────────
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull().references(() => entities.id),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    provider: integrationProviderEnum("provider").notNull(),
    status: integrationStatusEnum("status").notNull().default("pending"),
    // OAuth tokens stored encrypted (pgsodium / KMS in production)
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    tenantId: text("tenant_id"),        // Xero tenant / QBO realm
    tenantName: text("tenant_name"),
    scopes: text("scopes"),
    connectedBy: uuid("connected_by"),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientProviderIdx: index("integration_client_provider_idx").on(t.clientId, t.provider),
    entityIdx: index("integration_entity_idx").on(t.entityId),
  }),
);

// ── ledger_snapshots ──────────────────────────────────────────────────────────
export const ledgerSnapshots = pgTable(
  "ledger_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull().references(() => entities.id),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    caseId: uuid("case_id").references(() => onboardingCases.id),
    connectionId: uuid("connection_id").notNull().references(() => integrationConnections.id),
    provider: integrationProviderEnum("provider").notNull(),
    kind: ledgerSnapshotKindEnum("kind").notNull(),
    period: text("period"),             // e.g. "2024-04" or "2024-04-01/2025-03-31"
    payload: jsonb("payload").notNull().default({}),
    pulledAt: timestamp("pulled_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientKindIdx: index("ledger_snapshot_client_kind_idx").on(t.clientId, t.kind),
    caseIdx: index("ledger_snapshot_case_idx").on(t.caseId),
  }),
);
