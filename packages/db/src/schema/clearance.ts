import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clearanceOutcomeEnum, clearanceStatusEnum } from "./enums";
import { onboardingCases } from "./cases";
import { entities } from "./tenancy";
import { clients } from "./clients";

// ── professional_clearance_requests ──────────────────────────────────────────
export const clearanceRequests = pgTable(
  "professional_clearance_requests",
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
    prevFirmName: text("prev_firm_name").notNull(),
    prevFirmEmail: text("prev_firm_email"),
    prevFirmAddress: text("prev_firm_address"),
    status: clearanceStatusEnum("status").notNull().default("draft"),
    outcome: clearanceOutcomeEnum("outcome"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    nextChaseAt: timestamp("next_chase_at", { withTimezone: true }),
    responseNotes: text("response_notes"),
    responseData: jsonb("response_data"),
    sentBy: uuid("sent_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("clearance_requests_case_idx").on(t.caseId),
  }),
);

// ── clearance_followups ───────────────────────────────────────────────────────
export const clearanceFollowups = pgTable(
  "clearance_followups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => clearanceRequests.id),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    chaseNumber: text("chase_number").notNull().default("1"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    sentBy: uuid("sent_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestIdx: index("clearance_followups_request_idx").on(t.requestId),
  }),
);
