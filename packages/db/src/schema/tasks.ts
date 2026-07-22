import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { actorStamps, softDelete, timestamps } from "./_shared";
import { caseStatusEnum, taskSourceEnum, taskStatusEnum } from "./enums";
import { entities } from "./tenancy";
import { onboardingCases } from "./cases";

/**
 * Tasks + templates (A3 §3.6, FR-TASK-*). Templates declare which task to spawn
 * at which case state; tasks are the assignable work items with SLA tracking.
 */
export const taskTemplates = pgTable("task_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").references(() => entities.id), // null = applies to all entities
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  defaultRole: text("default_role"),
  slaHours: text("sla_hours"),
  triggerState: caseStatusEnum("trigger_state"),
  conditions: jsonb("conditions").$type<Record<string, unknown>>().default({}),
  ...timestamps,
  ...softDelete,
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id").references(() => onboardingCases.id),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("open"),
    assignedTo: uuid("assigned_to"),
    role: text("role"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    slaBreached: boolean("sla_breached").notNull().default(false),
    parentTaskId: uuid("parent_task_id"),
    source: taskSourceEnum("source").notNull().default("auto"),
    ...timestamps,
    ...actorStamps,
    ...softDelete,
  },
  (t) => ({
    byAssignee: index("idx_tasks_assignee").on(t.assignedTo, t.status, t.dueAt),
    byCase: index("idx_tasks_case").on(t.caseId),
  }),
);
