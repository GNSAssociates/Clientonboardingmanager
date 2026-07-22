import { z } from "zod";
import {
  withSession,
  insertGeneratedDoc,
  insertEnvelope,
  updateEnvelope,
  insertEsignEvent,
  listGeneratedDocsByCase,
  listEnvelopesByCase,
  getEnvelopeById,
  getEnvelopeByProviderRef,
  getGeneratedDocById,
  insertAudit,
  getDb,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { authorize } from "../rbac";
import { NotFoundError } from "../errors";
import { emitEvent } from "../events";
import {
  renderTemplate,
  wrapHtml,
  AUTH_LETTER_TEMPLATE,
  ENGAGEMENT_LETTER_TEMPLATE,
  TEMPLATE_KEYS,
} from "../templates/index";
import type { ESignProvider } from "../ports";

/* ── input schemas ───────────────────────────────────────────────────────── */

export const generateLetterSchema = z.object({
  caseId: z.string().uuid(),
  entityId: z.string().uuid(),
  clientId: z.string().uuid(),
  type: z.enum(["auth_letter", "engagement_letter"]),
  templateData: z.record(z.unknown()),
});
export type GenerateLetterInput = z.input<typeof generateLetterSchema>;

export const sendForSigningSchema = z.object({
  generatedDocId: z.string().uuid(),
  caseId: z.string().uuid(),
  entityId: z.string().uuid(),
  signers: z.array(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  ),
  documentUrl: z.string().url().optional(),
});
export type SendForSigningInput = z.input<typeof sendForSigningSchema>;

export const handleEsignWebhookSchema = z.object({
  providerRef: z.string().min(1),
  eventType: z.string().min(1),
  signerEmail: z.string().optional(),
  rawPayload: z.record(z.unknown()),
});

/* ── service functions ───────────────────────────────────────────────────── */

/**
 * Generate an authority or engagement letter HTML (PDF in production).
 * Renders the Handlebars template, stores the HTML output as the document.
 * In production the HTML is passed to a PDF rendering service.
 */
export async function generateLetter(
  session: AuthSession,
  rawInput: GenerateLetterInput,
): Promise<{ docId: string; html: string }> {
  authorize(session, "generate_documents");
  const input = generateLetterSchema.parse(rawInput);

  const templateSource =
    input.type === "auth_letter" ? AUTH_LETTER_TEMPLATE : ENGAGEMENT_LETTER_TEMPLATE;

  const templateKey =
    input.type === "auth_letter" ? TEMPLATE_KEYS.AUTH_LETTER : TEMPLATE_KEYS.ENGAGEMENT_LETTER;

  const html = wrapHtml(
    renderTemplate(templateSource, input.templateData),
    `${input.type === "auth_letter" ? "Authority to Act" : "Letter of Engagement"} — GNS`,
  );

  const storagePath = `entities/${input.entityId}/cases/${input.caseId}/generated/${input.type}-${Date.now()}.html`;

  const docId = await withSession(session, async (tx) => {
    const doc = await insertGeneratedDoc(tx, {
      entityId: input.entityId,
      caseId: input.caseId,
      clientId: input.clientId,
      type: input.type,
      templateKey,
      storagePath,
      mimeType: "text/html",
      templateData: input.templateData,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    await insertAudit(tx, {
      entityId: input.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "document.generated",
      resourceType: "generated_document",
      resourceId: doc.id,
      after: { type: input.type, templateKey, storagePath },
    });

    await emitEvent(tx, {
      entityId: input.entityId,
      type: "document.generated",
      payload: { docId: doc.id, caseId: input.caseId, docType: input.type },
    });

    return doc.id;
  });

  return { docId, html };
}

/**
 * Send a generated document for e-signature via the registered ESignProvider.
 */
export async function sendForSigning(
  session: AuthSession,
  rawInput: SendForSigningInput,
  esignProvider: ESignProvider,
): Promise<{ envelopeId: string; providerRef: string }> {
  authorize(session, "send_esign");
  const input = sendForSigningSchema.parse(rawInput);

  const doc = await withSession(session, async (tx) => getGeneratedDocById(tx, input.generatedDocId));
  if (!doc) throw new NotFoundError(`Generated document not found: ${input.generatedDocId}`);

  const documentUrl =
    input.documentUrl ?? `${process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"}/api/v1/generated-docs/${input.generatedDocId}/content`;

  const { envelopeId: providerRef } = await esignProvider.createEnvelope({
    documentUrl,
    signers: input.signers,
  });

  const envelopeId = await withSession(session, async (tx) => {
    const envelope = await insertEnvelope(tx, {
      entityId: input.entityId,
      caseId: input.caseId,
      generatedDocId: input.generatedDocId,
      provider: esignProvider.provider,
      providerRef,
      status: "sent",
      signers: input.signers,
      sentAt: new Date(),
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    await insertAudit(tx, {
      entityId: input.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "esign.sent",
      resourceType: "esign_envelope",
      resourceId: envelope.id,
      after: { providerRef, signers: input.signers.map((s) => s.email) },
    });

    await emitEvent(tx, {
      entityId: input.entityId,
      type: "esign.sent",
      payload: {
        envelopeId: envelope.id,
        caseId: input.caseId,
        providerRef,
      },
    });

    return envelope.id;
  });

  return { envelopeId, providerRef };
}

/**
 * Void an active e-sign envelope (staff action or timeout).
 */
export async function voidEnvelope(
  session: AuthSession,
  envelopeDbId: string,
  esignProvider: ESignProvider,
): Promise<void> {
  authorize(session, "send_esign");

  const envelope = await withSession(session, async (tx) => getEnvelopeById(tx, envelopeDbId));
  if (!envelope) throw new NotFoundError(`Envelope not found: ${envelopeDbId}`);

  if (envelope.providerRef) {
    await esignProvider.void(envelope.providerRef).catch(() => {
      // provider void may fail if already completed — continue to update DB
    });
  }

  await withSession(session, async (tx) => {
    await updateEnvelope(tx, envelopeDbId, {
      status: "voided",
      voidedAt: new Date(),
      updatedBy: session.userId,
    });

    await insertAudit(tx, {
      entityId: envelope.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "esign.voided",
      resourceType: "esign_envelope",
      resourceId: envelopeDbId,
      after: { status: "voided" },
    });
  });
}

/**
 * Process an inbound e-sign webhook event (provider → our system).
 * Updates envelope status and records the raw event for audit.
 */
export async function handleEsignWebhook(
  rawInput: z.input<typeof handleEsignWebhookSchema>,
): Promise<void> {
  const input = handleEsignWebhookSchema.parse(rawInput);

  const db = getDb();

  const statusMap: Record<string, EsignEnvelopeRow["status"]> = {
    signature_request_signed: "signed",
    signature_request_declined: "declined",
    signature_request_canceled: "voided",
    signature_request_expired: "expired",
    signature_request_viewed: "viewed",
  };
  const newStatus = statusMap[input.eventType];

  await db.transaction(async (tx) => {
    const envelope = await getEnvelopeByProviderRef(tx as never, input.providerRef);
    if (!envelope) return; // unknown provider ref — ignore

    if (newStatus) {
      await updateEnvelope(tx as never, envelope.id, {
        status: newStatus,
        ...(newStatus === "signed" ? { signedAt: new Date() } : {}),
        ...(newStatus === "voided" ? { voidedAt: new Date() } : {}),
      });
    }

    await insertEsignEvent(tx as never, {
      envelopeId: envelope.id,
      eventType: input.eventType,
      signerEmail: input.signerEmail,
      rawPayload: input.rawPayload,
    });
  });
}

/** Convenience: list all generated docs + envelopes for a case. */
export async function listGeneratedDocsForCase(session: AuthSession, caseId: string) {
  authorize(session, "view_documents");

  return withSession(session, async (tx) => {
    const [docs, envelopes] = await Promise.all([
      listGeneratedDocsByCase(tx, caseId),
      listEnvelopesByCase(tx, caseId),
    ]);
    return { docs, envelopes };
  });
}

// Re-export row type for use in UI
type EsignEnvelopeRow = import("@gns/db").EsignEnvelopeRow;
