import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { actorTypeEnum, eventStatusEnum } from "./enums";
import { entities } from "./tenancy";

/**
 * Platform cross-cutting tables (A3 §3.10).
 *
 * `audit_logs` — append-only evidence trail (NFR-AUD-1, CR-DATA-6). The app
 * writes a row in the same transaction as every mutating use-case; app DB roles
 * get no UPDATE/DELETE on this table (enforced via grants in M1).
 *
 * `events` — transactional outbox (NFR-REL-1). Written in the same tx as a
 * state change; an async worker / n8n dispatches them at-least-once with an
 * idempotency key for effectively-once side effects.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").references(() => entities.id),
    actorId: uuid("actor_id"),
    actorType: actorTypeEnum("actor_type").notNull().default("user"),
    action: text("action").notNull(), // e.g. "case.transition"
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    ip: text("ip"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byResource: index("idx_audit_resource").on(t.resourceType, t.resourceId, t.occurredAt),
    byEntity: index("idx_audit_entity").on(t.entityId, t.occurredAt),
  }),
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").references(() => entities.id),
    type: text("type").notNull(), // e.g. "case.engagement_signed"
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: eventStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    dispatchScan: index("idx_events_dispatch").on(t.status, t.availableAt),
  }),
);
