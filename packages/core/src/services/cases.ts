import type { CaseStatus } from "@gns/config";
import {
  getCaseById,
  getClientById,
  insertAudit,
  insertTransition,
  listCases,
  listChecklist,
  listClientServices,
  setCaseStatus,
  withSession,
  type CaseRow,
  type ChecklistRow,
  type ClientRow,
  type Tx,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { NotFoundError } from "../errors";
import { authorize, can } from "../rbac";
import { assertTransition } from "../state-machine";
import { emitEvent } from "../events";

/**
 * Apply a guarded transition inside an existing transaction (A2 §5, FR-WF-1):
 * assert legality, update status, append the transition + audit, emit the
 * domain event — all atomic. Reused by lead/services/pricing flows and the
 * generic transition endpoint.
 */
export async function applyTransition(
  tx: Tx,
  session: AuthSession,
  current: CaseRow,
  to: CaseStatus,
  reason?: string,
  gates: Record<string, boolean> = {},
): Promise<CaseRow> {
  assertTransition(current.status, to, { gates });
  const updated = await setCaseStatus(
    tx,
    current.id,
    to,
    to === "completed" ? { completedAt: new Date() } : {},
  );
  await insertTransition(tx, {
    caseId: current.id,
    fromStatus: current.status,
    toStatus: to,
    actorId: session.userId,
    reason,
  });
  await insertAudit(tx, {
    entityId: current.entityId,
    actorId: session.userId,
    actorType: "user",
    action: "case.transition",
    resourceType: "onboarding_cases",
    resourceId: current.id,
    before: { status: current.status },
    after: { status: to },
  });
  await emitEvent(tx, { entityId: current.entityId, type: `case.${to}`, payload: { caseId: current.id } });
  return updated;
}

/** Public transition endpoint use-case. */
export function transitionCase(
  session: AuthSession,
  caseId: string,
  to: CaseStatus,
  reason?: string,
): Promise<CaseRow> {
  authorize(session, to === "completed" ? "complete_onboarding" : "create_case");
  return withSession(session, async (tx) => {
    const current = await getCaseById(tx, caseId);
    if (!current) throw new NotFoundError("Case not found");
    return applyTransition(tx, session, current, to, reason);
  });
}

export function listCasesForSession(
  session: AuthSession,
  filter: { status?: CaseRow["status"]; assignedTo?: string } = {},
): Promise<CaseRow[]> {
  authorize(session, "view_assigned_cases");
  const assignedTo = can(session, "view_all_cases") ? filter.assignedTo : session.userId;
  return withSession(session, (tx) =>
    listCases(tx, {
      entityIds: session.isAdmin ? undefined : session.entityIds,
      status: filter.status,
      assignedTo,
    }),
  );
}

export interface CaseDetail {
  case: CaseRow;
  client: ClientRow | undefined;
  checklist: ChecklistRow[];
  services: Awaited<ReturnType<typeof listClientServices>>;
}

export async function getCaseDetail(session: AuthSession, caseId: string): Promise<CaseDetail> {
  authorize(session, "view_assigned_cases");
  return withSession(session, async (tx) => {
    const found = await getCaseById(tx, caseId);
    if (!found) throw new NotFoundError("Case not found");
    const [client, checklist, services] = await Promise.all([
      getClientById(tx, found.clientId),
      listChecklist(tx, caseId),
      listClientServices(tx, caseId),
    ]);
    return { case: found, client, checklist, services };
  });
}
