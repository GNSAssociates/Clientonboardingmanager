import { z } from "zod";
import {
  getCaseById,
  getServicesByIds,
  insertAudit,
  insertChecklistItems,
  insertClientServices,
  insertPricingAgreement,
  listActiveServices,
  listClientServices,
  withSession,
  type NewChecklistItem,
  type PricingRow,
  type ServiceRow,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { NotFoundError } from "../errors";
import { authorize } from "../rbac";
import { applyTransition } from "./cases";

/** Service catalogue + per-case selection + pricing (FR-SVC/PRICE-*). */
export function listServicesForSession(session: AuthSession): Promise<ServiceRow[]> {
  authorize(session, "create_case");
  return withSession(session, (tx) => listActiveServices(tx));
}

export const selectServicesSchema = z.object({ serviceIds: z.array(z.string().uuid()).min(1) });

export function selectServices(
  session: AuthSession,
  caseId: string,
  input: z.input<typeof selectServicesSchema>,
) {
  authorize(session, "create_case");
  const { serviceIds } = selectServicesSchema.parse(input);
  return withSession(session, async (tx) => {
    const current = await getCaseById(tx, caseId);
    if (!current) throw new NotFoundError("Case not found");

    const svcs = await getServicesByIds(tx, serviceIds);
    await insertClientServices(
      tx,
      svcs.map((s) => ({
        entityId: current.entityId,
        caseId: current.id,
        clientId: current.clientId,
        serviceId: s.id,
      })),
    );

    // Extend the checklist with service-specific required documents.
    const items: NewChecklistItem[] = svcs.flatMap((s) =>
      (s.requiredDocuments ?? []).map((doc) => ({
        entityId: current.entityId,
        caseId: current.id,
        key: `${s.code}:${doc}`,
        label: doc,
        category: s.code,
        responsible: "client" as const,
      })),
    );
    await insertChecklistItems(tx, items);

    await insertAudit(tx, {
      entityId: current.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "services.selected",
      resourceType: "onboarding_cases",
      resourceId: current.id,
      after: { serviceIds },
    });

    if (current.status === "lead") {
      await applyTransition(tx, session, current, "service_selection", "Services selected");
    }
    return listClientServices(tx, caseId);
  });
}

export const acceptPricingSchema = z.object({
  total: z.number().positive(),
  model: z.enum(["fixed", "tiered", "custom"]).default("fixed"),
  lineItems: z.array(z.record(z.unknown())).optional(),
});

export function acceptPricing(
  session: AuthSession,
  caseId: string,
  input: z.input<typeof acceptPricingSchema>,
): Promise<PricingRow> {
  authorize(session, "create_case");
  const data = acceptPricingSchema.parse(input);
  return withSession(session, async (tx) => {
    const current = await getCaseById(tx, caseId);
    if (!current) throw new NotFoundError("Case not found");

    const pricing = await insertPricingAgreement(tx, {
      entityId: current.entityId,
      caseId: current.id,
      model: data.model,
      total: data.total.toFixed(2),
      lineItems: data.lineItems ?? [],
      acceptedAt: new Date(),
      acceptedByContactId: null,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    await insertAudit(tx, {
      entityId: current.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "pricing.accepted",
      resourceType: "onboarding_cases",
      resourceId: current.id,
      after: { total: pricing.total },
    });

    if (current.status === "service_selection") {
      await applyTransition(tx, session, current, "pricing_agreed", "Pricing accepted");
    }
    return pricing;
  });
}
