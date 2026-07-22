import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { actorStamps, softDelete, timestamps } from "./_shared";
import { authProviderEnum, roleEnum, userStatusEnum } from "./enums";

/**
 * Tenancy & identity (A3 §3.1). The `entities` table is the white-label root
 * (BR-ENT-1..6): each row carries its own branding, bank, signatory and AML
 * supervisor. Full RLS policies land in M1; M0 establishes the tables.
 */
export const entities = pgTable("entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // GNS / LLP / GXY
  legalName: text("legal_name").notNull(),
  tradingName: text("trading_name"),
  logoUrl: text("logo_url"),
  brand: jsonb("brand").$type<Record<string, unknown>>().default({}),
  address: jsonb("address").$type<Record<string, unknown>>().notNull(),
  bankDetails: jsonb("bank_details").$type<Record<string, unknown>>(), // encrypted at app layer
  signatory: jsonb("signatory").$type<Record<string, unknown>>().notNull(),
  amlSupervisor: jsonb("aml_supervisor").$type<Record<string, unknown>>().notNull(),
  vatNumber: text("vat_number"),
  companyNumber: text("company_number"),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
  ...softDelete,
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").references(() => entities.id), // null for cross-entity admins
    email: text("email").notNull().unique(),
    authProvider: authProviderEnum("auth_provider").notNull(),
    externalId: text("external_id"),
    displayName: text("display_name"),
    status: userStatusEnum("status").notNull().default("active"),
    ...timestamps,
    ...softDelete,
  },
  (t) => ({
    byEntity: index("idx_users_entity").on(t.entityId),
  }),
);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: roleEnum("name").notNull().unique(),
  description: text("description"),
  ...timestamps,
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    entityId: uuid("entity_id").references(() => entities.id), // role grant scoped to an entity
    ...timestamps,
    ...actorStamps,
  },
  (t) => ({
    byUser: index("idx_user_roles_user").on(t.userId),
    uniqueGrant: uniqueIndex("uq_user_role_entity").on(t.userId, t.roleId, t.entityId),
  }),
);
