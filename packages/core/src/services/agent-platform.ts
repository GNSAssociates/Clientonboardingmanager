import { z } from "zod";
import {
  getDb,
  insertAgentRun,
  updateAgentRun,
  getAgentRunById,
  insertAgentApproval,
  getAgentApprovalById,
  listPendingApprovals,
  resolveAgentApproval,
  listAgentRunsByCase,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { authorize } from "../rbac";

// ── Schemas ───────────────────────────────────────────────────────────────────

export const TriggerAgentInput = z.object({
  entityId: z.string().uuid(),
  caseId: z.string().uuid().optional(),
  agentName: z.string().min(1),
  input: z.record(z.unknown()),
});

export const ResolveApprovalInput = z.object({
  entityId: z.string().uuid(),
  approvalId: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "modified"]),
  reviewerNotes: z.string().optional(),
  modifiedOutput: z.record(z.unknown()).optional(),
});

// ── Service functions ─────────────────────────────────────────────────────────

export async function triggerAgent(
  session: AuthSession,
  input: z.infer<typeof TriggerAgentInput>,
): Promise<{ runId: string }> {
  authorize(session, "run_agents");
  const parsed = TriggerAgentInput.parse(input);

  return getDb().transaction(async (tx) => {
    const run = await insertAgentRun(tx, {
      entityId: parsed.entityId,
      caseId: parsed.caseId,
      agentName: parsed.agentName,
      status: "pending",
      input: parsed.input,
      triggeredBy: session.userId,
      startedAt: new Date(),
    });
    return { runId: run.id };
  });
}

export async function recordAgentResult(
  session: AuthSession,
  runId: string,
  result: {
    output: Record<string, unknown>;
    confidence: number;
    needsHitl: boolean;
    assignedRole?: string;
  },
): Promise<{ approvalId?: string }> {
  authorize(session, "run_agents");

  return getDb().transaction(async (tx) => {
    const run = await getAgentRunById(tx, runId);
    if (!run) throw new Error(`Agent run ${runId} not found`);

    if (result.needsHitl) {
      await updateAgentRun(tx, runId, {
        status: "awaiting_hitl",
        output: result.output,
        confidence: result.confidence,
        completedAt: new Date(),
      });

      const dueAt = new Date();
      dueAt.setHours(dueAt.getHours() + 24);

      const approval = await insertAgentApproval(tx, {
        entityId: run.entityId,
        runId,
        caseId: run.caseId ?? undefined,
        agentName: run.agentName,
        assignedRole: result.assignedRole ?? "Manager",
        proposedOutput: result.output,
        dueAt,
      });

      return { approvalId: approval.id };
    } else {
      await updateAgentRun(tx, runId, {
        status: "completed",
        output: result.output,
        confidence: result.confidence,
        completedAt: new Date(),
      });
      return {};
    }
  });
}

export async function resolveHitlApproval(
  session: AuthSession,
  input: z.infer<typeof ResolveApprovalInput>,
): Promise<{ finalOutput: Record<string, unknown> }> {
  authorize(session, "approve_ai_compliance");
  const parsed = ResolveApprovalInput.parse(input);

  return getDb().transaction(async (tx) => {
    const approval = await getAgentApprovalById(tx, parsed.approvalId);
    if (!approval) throw new Error(`Approval ${parsed.approvalId} not found`);
    if (approval.decision) throw new Error("Approval already resolved");

    await resolveAgentApproval(
      tx,
      parsed.approvalId,
      parsed.decision,
      session.userId,
      parsed.reviewerNotes,
      parsed.modifiedOutput,
    );

    await updateAgentRun(tx, approval.runId, { status: "completed" });

    const finalOutput =
      parsed.decision === "modified" && parsed.modifiedOutput
        ? parsed.modifiedOutput
        : (approval.proposedOutput as Record<string, unknown>);

    return { finalOutput };
  });
}

export async function getPendingApprovals(session: AuthSession, entityId: string) {
  authorize(session, "approve_ai_compliance");
  return getDb().transaction((tx) => listPendingApprovals(tx, entityId));
}

export async function getAgentRunsForCase(session: AuthSession, caseId: string) {
  authorize(session, "view_assigned_cases");
  return getDb().transaction((tx) => listAgentRunsByCase(tx, caseId));
}
