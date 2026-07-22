import { index, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agentRunStatusEnum, hitlDecisionEnum } from "./enums";
import { entities } from "./tenancy";
import { onboardingCases } from "./cases";

// ── agent_runs ────────────────────────────────────────────────────────────────
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull().references(() => entities.id),
    caseId: uuid("case_id").references(() => onboardingCases.id),
    agentName: text("agent_name").notNull(),
    status: agentRunStatusEnum("status").notNull().default("pending"),
    input: jsonb("input").notNull().default({}),
    output: jsonb("output"),
    confidence: real("confidence"),
    errorMessage: text("error_message"),
    triggeredBy: uuid("triggered_by"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("agent_runs_case_idx").on(t.caseId),
    statusIdx: index("agent_runs_status_idx").on(t.status),
  }),
);

// ── agent_approvals (HITL queue) ──────────────────────────────────────────────
export const agentApprovals = pgTable(
  "agent_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull().references(() => entities.id),
    runId: uuid("run_id").notNull().references(() => agentRuns.id),
    caseId: uuid("case_id").references(() => onboardingCases.id),
    agentName: text("agent_name").notNull(),
    assignedRole: text("assigned_role").notNull(),
    proposedOutput: jsonb("proposed_output").notNull().default({}),
    reviewerNotes: text("reviewer_notes"),
    decision: hitlDecisionEnum("decision"),
    modifiedOutput: jsonb("modified_output"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index("agent_approvals_run_idx").on(t.runId),
    pendingIdx: index("agent_approvals_pending_idx").on(t.entityId, t.decision),
  }),
);
