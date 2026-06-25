"use server";

import { revalidatePath } from "next/cache";
import { generateLetter, sendForSigning, voidEnvelope } from "@gns/core";
import { adapters } from "@gns/integrations";
import { IntegrationError } from "@gns/core";
import { requireCapability } from "@/lib/auth/session";

export async function generateLetterAction(formData: FormData) {
  const session = requireCapability("generate_documents");

  const caseId = formData.get("caseId") as string;
  const entityId = formData.get("entityId") as string;
  const clientId = formData.get("clientId") as string;
  const type = formData.get("type") as "auth_letter" | "engagement_letter";

  // Build template data from form fields
  const templateData: Record<string, unknown> = {
    date: new Date().toISOString(),
    reference: formData.get("reference") as string,
    entity: {
      legalName: formData.get("entityLegalName") as string,
      address: formData.get("entityAddress") as string,
      signatoryName: formData.get("entitySignatory") as string,
    },
    client: {
      name: formData.get("clientName") as string,
      companyNumber: formData.get("clientCompanyNumber") || undefined,
      type: formData.get("clientType") as string,
    },
    contact: {
      name: formData.get("contactName") as string,
      email: formData.get("contactEmail") as string,
    },
    services: [],
    fees: {
      total: formData.get("feesTotal") || "TBC",
      currency: "£",
    },
  };

  await generateLetter(session, { caseId, entityId, clientId, type, templateData });
  revalidatePath(`/staff/cases/${caseId}/letters`);
}

export async function sendForSigningAction(formData: FormData) {
  const session = requireCapability("send_esign");

  if (!adapters.esign) throw new IntegrationError("esign", "No e-sign provider configured");

  const caseId = formData.get("caseId") as string;
  const entityId = formData.get("entityId") as string;
  const generatedDocId = formData.get("generatedDocId") as string;
  const signerName = formData.get("signerName") as string;
  const signerEmail = formData.get("signerEmail") as string;

  await sendForSigning(
    session,
    { caseId, entityId, generatedDocId, signers: [{ name: signerName, email: signerEmail }] },
    adapters.esign,
  );

  revalidatePath(`/staff/cases/${caseId}/letters`);
}

export async function voidEnvelopeAction(formData: FormData) {
  const session = requireCapability("send_esign");

  if (!adapters.esign) throw new IntegrationError("esign", "No e-sign provider configured");

  const envelopeId = formData.get("envelopeId") as string;
  const caseId = formData.get("caseId") as string;

  await voidEnvelope(session, envelopeId, adapters.esign);
  revalidatePath(`/staff/cases/${caseId}/letters`);
}
