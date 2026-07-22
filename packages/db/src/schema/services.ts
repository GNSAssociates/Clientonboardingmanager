import { boolean, index, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { actorStamps, softDelete, timestamps } from "./_shared";
import { pricingModelEnum } from "./enums";
import { entities } from "./tenancy";
import { clients } from "./clients";
import { onboardingCases } from "./cases";

/**
 * Service catalogue + per-case selection + pricing (A3 §3.2, FR-SVC/PRICE-*).
 * `required_documents` seeds the onboarding checklist; `requires_clearance`
 * drives whether the clearance step applies (per service + entity).
 */
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  defaultParams: jsonb("default_params").$type<Record<string, unknown>>().default({}),
  requiresClearance: boolean("requires_clearance").notNull().default(false),
  requiredDocuments: jsonb("required_documents").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
  ...softDelete,
});

export const clientServices = pgTable(
  "client_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    params: jsonb("params").$type<Record<string, unknown>>().default({}),
    ...timestamps,
    ...softDelete,
  },
  (t) => ({
    byCase: index("idx_client_services_case").on(t.caseId),
    uniquePerCase: index("uq_client_service_case").on(t.caseId, t.serviceId),
  }),
);

export const pricingAgreements = pgTable("pricing_agreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  caseId: uuid("case_id")
    .notNull()
    .references(() => onboardingCases.id),
  model: pricingModelEnum("model").notNull().default("fixed"),
  lineItems: jsonb("line_items").$type<Record<string, unknown>[]>().default([]),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("GBP"),
  version: text("version").notNull().default("1"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedByContactId: uuid("accepted_by_contact_id"),
  ...timestamps,
  ...actorStamps,
});
