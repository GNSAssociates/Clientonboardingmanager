import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { actorStamps, softDelete, timestamps } from "./_shared";
import {
  caseStatusEnum,
  caseSubstatusEnum,
  checklistStatusEnum,
  responsibleEnum,
  riskRatingEnum,
} from "./enums";
import { entities } from "./tenancy";
import { clients } from "./clients";

/**
 * Onboarding case = the state machine instance (A3 §3.3, FR-WF-1, PRD §11).
 * Transitions are append-only history; checklist items track required docs/actions.
 */
export const onboardingCases = pgTable(
  "onboarding_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    reference: text("reference").notNull().unique(),
    status: caseStatusEnum("status").notNull().default("lead"),
    substatus: caseSubstatusEnum("substatus"),
    assignedTo: uuid("assigned_to"),
    riskRating: riskRatingEnum("risk_rating"),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
    blockedReason: text("blocked_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
    ...actorStamps,
    ...softDelete,
  },
  (t) => ({
    byEntityStatus: index("idx_cases_entity_status").on(t.entityId, t.status),
    byAssignee: index("idx_cases_assignee").on(t.assignedTo, t.status),
  }),
);

export const caseTransitions = pgTable(
  "case_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    fromStatus: caseStatusEnum("from_status"),
    toStatus: caseStatusEnum("to_status").notNull(),
    actorId: uuid("actor_id"),
    reason: text("reason"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byCase: index("idx_case_transitions_case").on(t.caseId, t.occurredAt),
  }),
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    key: text("key").notNull(),
    label: text("label").notNull(),
    category: text("category"),
    required: boolean("required").notNull().default(true),
    status: checklistStatusEnum("status").notNull().default("pending"),
    responsible: responsibleEnum("responsible").notNull().default("client"),
    documentId: uuid("document_id"),
    ...timestamps,
    ...softDelete,
  },
  (t) => ({
    byCase: index("idx_checklist_case").on(t.caseId, t.status),
  }),
);
