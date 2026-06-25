"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acceptPricing, createLead, selectServices, transitionCase } from "@gns/core";
import type { CaseStatus } from "@gns/config";
import { requireCapability } from "@/lib/auth/session";

/** Create a lead/new client (FR-LEAD). */
export async function createLeadAction(formData: FormData): Promise<void> {
  const session = requireCapability("create_case");
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const contactName = get("contactName");

  const created = await createLead(session, {
    entityId: get("entityId"),
    client: {
      type: get("type") as "limited" | "sole_trader" | "partnership" | "llp" | "individual",
      name: get("name"),
      companyNumber: get("companyNumber") || undefined,
      source: get("source") || undefined,
    },
    primaryContact: contactName
      ? { name: contactName, email: get("contactEmail") || undefined }
      : undefined,
  });

  redirect(`/staff/cases/${created.id}`);
}

/** Select services for a case (FR-SVC-2). */
export async function selectServicesAction(formData: FormData): Promise<void> {
  const session = requireCapability("create_case");
  const caseId = String(formData.get("caseId"));
  const serviceIds = formData.getAll("serviceIds").map(String);
  await selectServices(session, caseId, { serviceIds });
  revalidatePath(`/staff/cases/${caseId}`);
}

/** Accept pricing for a case (FR-PRICE-2). */
export async function acceptPricingAction(formData: FormData): Promise<void> {
  const session = requireCapability("create_case");
  const caseId = String(formData.get("caseId"));
  await acceptPricing(session, caseId, { total: Number(formData.get("total")) });
  revalidatePath(`/staff/cases/${caseId}`);
}

/** Advance the case to the given next status (FR-WF-1). */
export async function advanceAction(formData: FormData): Promise<void> {
  const session = requireCapability("create_case");
  const caseId = String(formData.get("caseId"));
  const to = String(formData.get("to")) as CaseStatus;
  await transitionCase(session, caseId, to, "Advanced by staff");
  revalidatePath(`/staff/cases/${caseId}`);
}
