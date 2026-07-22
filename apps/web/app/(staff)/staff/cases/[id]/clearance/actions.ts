"use server";

import { revalidatePath } from "next/cache";
import { adapters } from "@gns/integrations";
import {
  sendClearanceRequest,
  recordClearanceResponse,
  sendFollowup,
} from "@gns/core";
import { getSession } from "@/lib/auth/session";

export async function sendClearanceRequestAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const caseId = formData.get("caseId") as string;
  const entityId = formData.get("entityId") as string;

  await sendClearanceRequest(
    session,
    {
      entityId,
      caseId,
      clientId: formData.get("clientId") as string,
      clientName: formData.get("clientName") as string,
      companyNumber: (formData.get("companyNumber") as string) || undefined,
      prevFirmName: formData.get("prevFirmName") as string,
      prevFirmEmail: (formData.get("prevFirmEmail") as string) || undefined,
      prevFirmAddress: (formData.get("prevFirmAddress") as string) || undefined,
      responseDeadlineDays: Number(formData.get("responseDeadlineDays") ?? "14"),
      entityLegalName: formData.get("entityLegalName") as string,
      entityAddress: formData.get("entityAddress") as string,
      entitySignatoryName: formData.get("entitySignatoryName") as string,
      entityAmlSupervisor: formData.get("entityAmlSupervisor") as string,
    },
    adapters.mailer!,
  );

  revalidatePath(`/staff/cases/${caseId}/clearance`);
}

export async function recordResponseAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const caseId = formData.get("caseId") as string;
  const requestId = formData.get("requestId") as string;

  await recordClearanceResponse(session, {
    entityId: formData.get("entityId") as string,
    requestId,
    outcome: formData.get("outcome") as
      | "clear"
      | "issues_raised"
      | "no_response"
      | "refused",
    responseNotes: (formData.get("responseNotes") as string) || undefined,
  });

  revalidatePath(`/staff/cases/${caseId}/clearance`);
}

export async function sendFollowupAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const caseId = formData.get("caseId") as string;
  const requestId = formData.get("requestId") as string;

  await sendFollowup(
    session,
    {
      entityId: formData.get("entityId") as string,
      requestId,
      caseId,
      notes: (formData.get("notes") as string) || undefined,
    },
    adapters.mailer!,
  );

  revalidatePath(`/staff/cases/${caseId}/clearance`);
}
