import { z } from "zod";
import {
  getDb,
  insertReviewTask,
  getReviewTaskById,
  listReviewTasksByCase,
  updateReviewTask,
  insertReviewFinding,
  listFindingsByReview,
  resolveReviewFinding,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { authorize } from "../rbac";

const REVIEW_TYPES = ["bookkeeping", "vat", "paye", "cis", "accounts", "trial_balance", "self_assessment"] as const;

export const CreateReviewTaskInput = z.object({
  entityId: z.string().uuid(),
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  reviewType: z.enum(REVIEW_TYPES),
  period: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  snapshotId: z.string().uuid().optional(),
});

export const AddFindingInput = z.object({
  entityId: z.string().uuid(),
  reviewTaskId: z.string().uuid(),
  caseId: z.string().uuid(),
  severity: z.enum(["info", "warning", "error", "critical"]),
  category: z.string().min(1),
  description: z.string().min(1),
  affectedPeriod: z.string().optional(),
  evidence: z.record(z.unknown()).optional(),
  recommendedAction: z.string().optional(),
});

export const SignOffReviewInput = z.object({
  reviewTaskId: z.string().uuid(),
  summary: z.string().optional(),
});

export async function createReviewTask(
  session: AuthSession,
  input: z.infer<typeof CreateReviewTaskInput>,
) {
  authorize(session, "conduct_review");
  const parsed = CreateReviewTaskInput.parse(input);
  return getDb().transaction(async (tx) => {
    return insertReviewTask(tx, {
      ...parsed,
      status: "pending",
    });
  });
}

export async function startReview(session: AuthSession, reviewTaskId: string) {
  authorize(session, "conduct_review");
  return getDb().transaction(async (tx) => {
    return updateReviewTask(tx, reviewTaskId, {
      status: "in_progress",
      assignedTo: session.userId,
    });
  });
}

export async function addFinding(
  session: AuthSession,
  input: z.infer<typeof AddFindingInput>,
) {
  authorize(session, "conduct_review");
  const parsed = AddFindingInput.parse(input);
  return getDb().transaction(async (tx) => {
    const finding = await insertReviewFinding(tx, parsed);
    await updateReviewTask(tx, parsed.reviewTaskId, { status: "findings_raised" });
    return finding;
  });
}

export async function resolveFinding(
  session: AuthSession,
  findingId: string,
  notes?: string,
) {
  authorize(session, "conduct_review");
  return getDb().transaction(async (tx) => {
    return resolveReviewFinding(tx, findingId, session.userId, notes);
  });
}

export async function signOffReview(
  session: AuthSession,
  input: z.infer<typeof SignOffReviewInput>,
) {
  authorize(session, "conduct_review");
  const parsed = SignOffReviewInput.parse(input);
  return getDb().transaction(async (tx) => {
    return updateReviewTask(tx, parsed.reviewTaskId, {
      status: "signed_off",
      summary: parsed.summary,
      signedOffBy: session.userId,
      signedOffAt: new Date(),
      completedAt: new Date(),
    });
  });
}

export async function getReviewSummary(session: AuthSession, caseId: string) {
  authorize(session, "view_assigned_cases");
  return getDb().transaction(async (tx) => {
    const tasks = await listReviewTasksByCase(tx, caseId);
    const findingsPerTask = await Promise.all(
      tasks.map((t) => listFindingsByReview(tx, t.id)),
    );
    return {
      tasks: tasks.map((t, i) => ({ ...t, findings: findingsPerTask[i] ?? [] })),
    };
  });
}
