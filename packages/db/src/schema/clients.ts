import { boolean, index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { actorStamps, softDelete, timestamps } from "./_shared";
import { clientStatusEnum, clientTypeEnum, riskRatingEnum } from "./enums";
import { entities } from "./tenancy";

/**
 * Client master (A3 §3.1, FR-LEAD-*). Entity-scoped; the single source of truth
 * for a prospective/new client. Contacts (directors/PSCs/signatories) hang off
 * the client and feed KYC/CDD (M5).
 */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    type: clientTypeEnum("type").notNull(),
    name: text("name").notNull(),
    companyNumber: text("company_number"),
    status: clientStatusEnum("status").notNull().default("prospect"),
    riskRating: riskRatingEnum("risk_rating"),
    source: text("source"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
    ...actorStamps,
    ...softDelete,
  },
  (t) => ({
    byEntityStatus: index("idx_clients_entity_status").on(t.entityId, t.status),
    byCompanyNumber: index("idx_clients_company_number").on(t.companyNumber),
  }),
);

export const clientContacts = pgTable(
  "client_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    isDirector: boolean("is_director").notNull().default(false),
    isPsc: boolean("is_psc").notNull().default(false),
    isSignatory: boolean("is_signatory").notNull().default(false),
    isPep: boolean("is_pep").notNull().default(false),
    ...timestamps,
    ...softDelete,
  },
  (t) => ({
    byClient: index("idx_client_contacts_client").on(t.clientId),
  }),
);
