import { z } from "zod";
import {
  countCasesForEntity,
  getEntity,
  insertAudit,
  insertCase,
  insertChecklistItems,
  insertClient,
  insertClientContact,
  insertTasks,
  insertTransition,
  withSession,
  type CaseRow,
  type NewChecklistItem,
  type Tx,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { ForbiddenError, NotFoundError } from "../errors";
import { authorize } from "../rbac";
import { emitEvent } from "../events";

/**
 * Lead intake (FR-LEAD-1,2). Creates the client, a contact, the onboarding case
 * (with a generated human reference), seeds the base CDD checklist, spawns the
 * first task, records the opening transition + audit, and emits `lead.created`
 * — all atomically.
 */
export const createLeadSchema = z.object({
  entityId: z.string().uuid(),
  client: z.object({
    type: z.enum(["limited", "sole_trader", "partnership", "llp", "individual"]),
    name: z.string().min(1),
    companyNumber: z.string().optional(),
    source: z.string().optional(),
  }),
  primaryContact: z
    .object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});
export type CreateLeadInput = z.input<typeof createLeadSchema>;

const BASE_CHECKLIST: { key: string; label: string; category: string }[] = [
  { key: "photo_id", label: "Photo ID (passport / driving licence)", category: "cdd" },
  { key: "proof_of_address", label: "Proof of address (< 3 months)", category: "cdd" },
];

function baseChecklist(entityId: string, caseId: string): NewChecklistItem[] {
  return BASE_CHECKLIST.map((i) => ({
    entityId,
    caseId,
    key: i.key,
    label: i.label,
    category: i.category,
    required: true,
    responsible: "client" as const,
  }));
}

export function createLead(session: AuthSession, input: CreateLeadInput): Promise<CaseRow> {
  authorize(session, "create_case");
  const data = createLeadSchema.parse(input);
  if (!session.isAdmin && !session.entityIds.includes(data.entityId)) {
    throw new ForbiddenError("Entity not in your scope");
  }

  return withSession(session, async (tx: Tx) => {
    const entity = await getEntity(tx, data.entityId);
    if (!entity) throw new NotFoundError("Entity not found");

    const client = await insertClient(tx, {
      entityId: data.entityId,
      type: data.client.type,
      name: data.client.name,
      companyNumber: data.client.companyNumber,
      status: "onboarding",
      source: data.client.source,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    if (data.primaryContact) {
      await insertClientContact(tx, {
        entityId: data.entityId,
        clientId: client.id,
        name: data.primaryContact.name,
        email: data.primaryContact.email,
        phone: data.primaryContact.phone,
        isPrimary: true,
      });
    }

    const seq = (await countCasesForEntity(tx, data.entityId)) + 1;
    const reference = `${entity.code}-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;

    const caseRow = await insertCase(tx, {
      entityId: data.entityId,
      clientId: client.id,
      reference,
      status: "lead",
      assignedTo: session.userId,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    await insertChecklistItems(tx, baseChecklist(data.entityId, caseRow.id));
    await insertTasks(tx, [
      {
        entityId: data.entityId,
        caseId: caseRow.id,
        title: "Select services & agree pricing",
        role: "OnboardingStaff",
        source: "auto",
      },
    ]);
    await insertTransition(tx, {
      caseId: caseRow.id,
      fromStatus: null,
      toStatus: "lead",
      actorId: session.userId,
      reason: "Lead created",
    });
    await insertAudit(tx, {
      entityId: data.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "lead.created",
      resourceType: "onboarding_cases",
      resourceId: caseRow.id,
      after: { reference },
    });
    await emitEvent(tx, { entityId: data.entityId, type: "lead.created", payload: { caseId: caseRow.id } });

    return caseRow;
  });
}
