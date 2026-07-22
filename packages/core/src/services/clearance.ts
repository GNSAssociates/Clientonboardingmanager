import { z } from "zod";
import {
  getDb,
  insertClearanceRequest,
  getClearanceRequestById,
  listClearanceRequestsByCase,
  updateClearanceRequest,
  insertClearanceFollowup,
  listFollowupsByRequest,
  insertGeneratedDoc,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { authorize } from "../rbac";
import { renderTemplate, wrapHtml, CLEARANCE_REQUEST_TEMPLATE } from "../templates";
import type { MailerPort } from "../ports";

// ── Schemas ──────────────────────────────────────────────────────────────────

export const SendClearanceRequestInput = z.object({
  entityId: z.string().uuid(),
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  clientName: z.string().min(1),
  companyNumber: z.string().optional(),
  prevFirmName: z.string().min(1),
  prevFirmEmail: z.string().email().optional(),
  prevFirmAddress: z.string().optional(),
  responseDeadlineDays: z.number().int().min(1).default(14),
  entityLegalName: z.string().min(1),
  entityAddress: z.string().min(1),
  entitySignatoryName: z.string().min(1),
  entityAmlSupervisor: z.string().min(1),
  entityRegistrationDetails: z.string().optional(),
});

export type SendClearanceRequestInput = z.infer<typeof SendClearanceRequestInput>;

export const RecordClearanceResponseInput = z.object({
  entityId: z.string().uuid(),
  requestId: z.string().uuid(),
  outcome: z.enum(["clear", "issues_raised", "no_response", "refused"]),
  responseNotes: z.string().optional(),
  responseData: z.record(z.unknown()).optional(),
});

export type RecordClearanceResponseInput = z.infer<typeof RecordClearanceResponseInput>;

export const SendFollowupInput = z.object({
  entityId: z.string().uuid(),
  requestId: z.string().uuid(),
  caseId: z.string().uuid(),
  notes: z.string().optional(),
});

export type SendFollowupInput = z.infer<typeof SendFollowupInput>;

// ── Service functions ─────────────────────────────────────────────────────────

export async function sendClearanceRequest(
  session: AuthSession,
  input: SendClearanceRequestInput,
  mailer: MailerPort,
): Promise<{ requestId: string; docId: string }> {
  authorize(session, "create_case");

  const parsed = SendClearanceRequestInput.parse(input);

  const templateData = {
    entity: {
      legalName: parsed.entityLegalName,
      address: parsed.entityAddress,
      signatoryName: parsed.entitySignatoryName,
      amlSupervisor: parsed.entityAmlSupervisor,
      registrationDetails: parsed.entityRegistrationDetails ?? "",
    },
    client: {
      name: parsed.clientName,
      companyNumber: parsed.companyNumber,
    },
    prevFirm: {
      name: parsed.prevFirmName,
      email: parsed.prevFirmEmail,
      address: parsed.prevFirmAddress,
    },
    date: new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    responseDeadlineDays: parsed.responseDeadlineDays,
  };

  const body = renderTemplate(CLEARANCE_REQUEST_TEMPLATE, templateData);
  const html = wrapHtml(body, `Professional Clearance Request — ${parsed.clientName}`);
  const storagePath = `entities/${parsed.entityId}/cases/${parsed.caseId}/generated/clearance_request-${Date.now()}.html`;

  return getDb().transaction(async (tx) => {
    const doc = await insertGeneratedDoc(tx, {
      entityId: parsed.entityId,
      caseId: parsed.caseId,
      clientId: parsed.clientId,
      type: "clearance_request",
      templateKey: "clearance_request",
      storagePath,
      mimeType: "text/html",
      templateData: templateData as unknown as Record<string, unknown>,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    const now = new Date();
    const nextChase = new Date(now);
    nextChase.setDate(nextChase.getDate() + 3);

    const request = await insertClearanceRequest(tx, {
      entityId: parsed.entityId,
      caseId: parsed.caseId,
      clientId: parsed.clientId,
      prevFirmName: parsed.prevFirmName,
      prevFirmEmail: parsed.prevFirmEmail,
      prevFirmAddress: parsed.prevFirmAddress,
      status: "sent",
      sentAt: now,
      nextChaseAt: nextChase,
      sentBy: session.userId,
    });

    if (parsed.prevFirmEmail) {
      await mailer.send({
        to: parsed.prevFirmEmail,
        subject: `Professional Clearance Request — ${parsed.clientName}`,
        html,
      });
    }

    return { requestId: request.id, docId: doc.id };
  });
}

export async function recordClearanceResponse(
  session: AuthSession,
  input: RecordClearanceResponseInput,
): Promise<void> {
  authorize(session, "create_case");
  const parsed = RecordClearanceResponseInput.parse(input);

  await getDb().transaction(async (tx) => {
    const existing = await getClearanceRequestById(tx, parsed.requestId);
    if (!existing) throw new Error(`Clearance request ${parsed.requestId} not found`);

    await updateClearanceRequest(tx, parsed.requestId, {
      status: "received",
      outcome: parsed.outcome,
      receivedAt: new Date(),
      responseNotes: parsed.responseNotes,
      responseData: parsed.responseData as Record<string, unknown>,
    });
  });
}

export async function sendFollowup(
  session: AuthSession,
  input: SendFollowupInput,
  mailer: MailerPort,
): Promise<{ followupId: string }> {
  authorize(session, "create_case");
  const parsed = SendFollowupInput.parse(input);

  return getDb().transaction(async (tx) => {
    const request = await getClearanceRequestById(tx, parsed.requestId);
    if (!request) throw new Error(`Clearance request ${parsed.requestId} not found`);

    const existingFollowups = await listFollowupsByRequest(tx, parsed.requestId);
    const chaseNumber = String(existingFollowups.length + 1);

    const followup = await insertClearanceFollowup(tx, {
      requestId: parsed.requestId,
      entityId: parsed.entityId,
      caseId: parsed.caseId,
      chaseNumber,
      sentAt: new Date(),
      sentBy: session.userId,
      notes: parsed.notes,
    });

    const nextChase = new Date();
    nextChase.setDate(nextChase.getDate() + 7);
    await updateClearanceRequest(tx, parsed.requestId, {
      status: "chased",
      nextChaseAt: nextChase,
    });

    if (request.prevFirmEmail) {
      await mailer.send({
        to: request.prevFirmEmail,
        subject: `Professional Clearance — Chase ${chaseNumber} — Re: ${request.prevFirmName}`,
        html: `<p>We write further to our letter of ${request.sentAt?.toLocaleDateString("en-GB") ?? ""} requesting professional clearance. We would be grateful for your response at your earliest convenience.</p>`,
      });
    }

    return { followupId: followup.id };
  });
}

export async function getClearanceSummary(
  session: AuthSession,
  caseId: string,
  entityId: string,
) {
  authorize(session, "create_case");

  void entityId; // used for future RLS scoping

  return getDb().transaction(async (tx) => {
    const requests = await listClearanceRequestsByCase(tx, caseId);
    const followupsPerRequest = await Promise.all(
      requests.map((r) => listFollowupsByRequest(tx, r.id)),
    );

    return {
      requests: requests.map((r, i) => ({
        ...r,
        followups: followupsPerRequest[i] ?? [],
      })),
    };
  });
}
