import { and, desc, eq, isNull } from "drizzle-orm";
import { agentApprovals, agentRuns } from "../schema/agent-runs";
import type { Tx } from "../client";

export type AgentRunRow = typeof agentRuns.$inferSelect;
export type AgentApprovalRow = typeof agentApprovals.$inferSelect;

// ── agent_runs ────────────────────────────────────────────────────────────────

export async function insertAgentRun(
  tx: Tx,
  data: typeof agentRuns.$inferInsert,
): Promise<AgentRunRow> {
  const [row] = await tx.insert(agentRuns).values(data).returning();
  return row!;
}

export async function updateAgentRun(
  tx: Tx,
  id: string,
  data: Partial<typeof agentRuns.$inferInsert>,
) {
  const [row] = await tx
    .update(agentRuns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agentRuns.id, id))
    .returning();
  return row ?? null;
}

export async function getAgentRunById(tx: Tx, id: string) {
  const [row] = await tx.select().from(agentRuns).where(eq(agentRuns.id, id));
  return row ?? null;
}

export async function listAgentRunsByCase(tx: Tx, caseId: string) {
  return tx
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.caseId, caseId))
    .orderBy(desc(agentRuns.createdAt));
}

// ── agent_approvals ───────────────────────────────────────────────────────────

export async function insertAgentApproval(
  tx: Tx,
  data: typeof agentApprovals.$inferInsert,
): Promise<AgentApprovalRow> {
  const [row] = await tx.insert(agentApprovals).values(data).returning();
  return row!;
}

export async function getAgentApprovalById(tx: Tx, id: string) {
  const [row] = await tx
    .select()
    .from(agentApprovals)
    .where(eq(agentApprovals.id, id));
  return row ?? null;
}

export async function listPendingApprovals(tx: Tx, entityId: string) {
  return tx
    .select()
    .from(agentApprovals)
    .where(
      and(
        eq(agentApprovals.entityId, entityId),
        isNull(agentApprovals.decision),
      ),
    )
    .orderBy(agentApprovals.createdAt);
}

export async function resolveAgentApproval(
  tx: Tx,
  id: string,
  decision: "approved" | "rejected" | "modified",
  reviewedBy: string,
  reviewerNotes?: string,
  modifiedOutput?: Record<string, unknown>,
) {
  const [row] = await tx
    .update(agentApprovals)
    .set({
      decision,
      reviewedBy,
      reviewerNotes,
      modifiedOutput,
      reviewedAt: new Date(),
    })
    .where(eq(agentApprovals.id, id))
    .returning();
  return row ?? null;
}
