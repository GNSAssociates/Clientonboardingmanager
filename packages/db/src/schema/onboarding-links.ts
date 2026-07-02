import { index, integer, json, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./tenancy";
import { clients } from "./clients";

export const onboardingLinks = pgTable(
  "onboarding_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").references(() => entities.id),
    clientId: uuid("client_id").references(() => clients.id),
    token: text("token").notNull().unique(),
    companyNumber: text("company_number"),
    companyName: text("company_name"),
    clientEmail: text("client_email").notNull(),
    status: text("status").notNull().default("sent"), // sent | accepted | expired
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    directorName: text("director_name"),
    directorEmail: text("director_email"),
    firmSlug: text("firm_slug"),
    services: json("services").$type<Array<{ id: string; name: string; price: number }>>(),
    resendCount: text("resend_count").notNull().default("0"),
    lastResentAt: timestamp("last_resent_at", { withTimezone: true }),
    // Follow-up tracking
    prevAccountantEmail: text("prev_accountant_email"),
    prevAccountantFirmName: text("prev_accountant_firm_name"),
    clientFollowUpCount: integer("client_follow_up_count").notNull().default(0),
    prevAccountantFollowUpCount: integer("prev_accountant_follow_up_count").notNull().default(0),
    clientFollowUpSentAt: timestamp("client_follow_up_sent_at", { withTimezone: true }),
    prevAccountantFollowUpSentAt: timestamp("prev_accountant_follow_up_sent_at", { withTimezone: true }),
    // Captured at signing: typed signature, contact preferences, direct debit details, doc statuses
    acceptanceData: json("acceptance_data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index("onboarding_links_entity_idx").on(t.entityId),
    tokenIdx: index("onboarding_links_token_idx").on(t.token),
    statusIdx: index("onboarding_links_status_idx").on(t.status),
    clientEmailIdx: index("onboarding_links_email_idx").on(t.clientEmail),
  }),
);
