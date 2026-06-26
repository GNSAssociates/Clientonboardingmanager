import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { findingSeverityEnum, reviewStatusEnum, reviewTypeEnum } from "./enums";
import { entities } from "./tenancy";
import { clients } from "./clients";
import { onboardingCases } from "./cases";

// ── review_tasks ──────────────────────────────────────────────────────────────
export const reviewTasks = pgTable(
  "review_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull().references(() => entities.id),
    caseId: uuid("case_id").notNull().references(() => onboardingCases.id),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    reviewType: reviewTypeEnum("review_type").notNull(),
    status: reviewStatusEnum("status").notNull().default("pending"),
    period: text("period"),
    assignedTo: uuid("assigned_to"),
    snapshotId: uuid("snapshot_id"),
    aiRunId: uuid("ai_run_id"),
    summary: text("summary"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    signedOffBy: uuid("signed_off_by"),
    signedOffAt: timestamp("signed_off_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("review_tasks_case_idx").on(t.caseId),
    statusIdx: index("review_tasks_status_idx").on(t.status),
  }),
);

// ── review_findings ───────────────────────────────────────────────────────────
export const reviewFindings = pgTable(
  "review_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull().references(() => entities.id),
    reviewTaskId: uuid("review_task_id").notNull().references(() => reviewTasks.id),
    caseId: uuid("case_id").notNull().references(() => onboardingCases.id),
    severity: findingSeverityEnum("severity").notNull().default("warning"),
    category: text("category").notNull(),
    description: text("description").notNull(),
    affectedPeriod: text("affected_period"),
    evidence: jsonb("evidence"),
    recommendedAction: text("recommended_action"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by"),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reviewTaskIdx: index("review_findings_task_idx").on(t.reviewTaskId),
    severityIdx: index("review_findings_severity_idx").on(t.severity),
  }),
);
