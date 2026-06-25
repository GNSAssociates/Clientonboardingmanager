"use server";

import { revalidatePath } from "next/cache";
import { verifyCompany, initiateKyc, recordCdd, approveComplianceGate } from "@gns/core";
import { adapters } from "@gns/integrations";
import { IntegrationError } from "@gns/core";
import { requireCapability } from "@/lib/auth/session";

export async function verifyCompanyAction(formData: FormData) {
  const session = requireCapability("perform_cdd");
  if (!adapters.companiesHouse) {
    throw new IntegrationError("companies_house", "Companies House adapter not configured");
  }

  const caseId = formData.get("caseId") as string;
  const entityId = formData.get("entityId") as string;
  const clientId = formData.get("clientId") as string;
  const companyNumber = formData.get("companyNumber") as string;

  await verifyCompany(session, { caseId, entityId, clientId, companyNumber }, adapters.companiesHouse);
  revalidatePath(`/staff/cases/${caseId}/compliance`);
}

export async function initiateKycAction(formData: FormData) {
  const session = requireCapability("perform_cdd");
  if (!adapters.kyc) throw new IntegrationError("kyc", "KYC provider not configured");

  const caseId = formData.get("caseId") as string;
  const entityId = formData.get("entityId") as string;
  const clientId = formData.get("clientId") as string;
  const subjectName = formData.get("subjectName") as string;
  const subjectEmail = formData.get("subjectEmail") as string;

  await initiateKyc(session, { caseId, entityId, clientId, subjectName, subjectEmail }, adapters.kyc);
  revalidatePath(`/staff/cases/${caseId}/compliance`);
}

export async function recordCddAction(formData: FormData) {
  const session = requireCapability("perform_cdd");

  const caseId = formData.get("caseId") as string;
  const entityId = formData.get("entityId") as string;
  const clientId = formData.get("clientId") as string;

  await recordCdd(session, {
    caseId,
    entityId,
    clientId,
    outcome: formData.get("outcome") as "standard" | "enhanced" | "simplified" | "refused",
    pepFlag: formData.get("pepFlag") === "on",
    sanctionsFlag: formData.get("sanctionsFlag") === "on",
    adverseMediaFlag: formData.get("adverseMediaFlag") === "on",
    sourceOfFunds: (formData.get("sourceOfFunds") as string) || undefined,
    sourceOfWealth: (formData.get("sourceOfWealth") as string) || undefined,
    businessActivity: (formData.get("businessActivity") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  });

  revalidatePath(`/staff/cases/${caseId}/compliance`);
}

export async function approveGateAction(formData: FormData) {
  const session = requireCapability("approve_ai_compliance");

  const caseId = formData.get("caseId") as string;
  const entityId = formData.get("entityId") as string;
  const gateName = formData.get("gateName") as string;
  const notes = (formData.get("notes") as string) || undefined;

  await approveComplianceGate(session, {
    caseId,
    entityId,
    gateName: gateName as never,
    notes,
    override: formData.get("override") === "true",
  });

  revalidatePath(`/staff/cases/${caseId}/compliance`);
}
