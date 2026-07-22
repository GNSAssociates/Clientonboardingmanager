import { z } from "zod";
import {
  withSession,
  insertDocument,
  insertDocumentVersion,
  insertClassification,
  getDocumentById,
  listDocumentsByCase,
  listClassificationsByDocument,
  updateDocument,
  linkDocumentToChecklist,
  confirmClassification,
  listChecklist,
  insertAudit,
} from "@gns/db";
import type { AuthSession } from "../auth";
import { authorize } from "../rbac";
import { NotFoundError } from "../errors";
import { emitEvent } from "../events";

/* ── input schemas ───────────────────────────────────────────────────────── */

export const recordUploadSchema = z.object({
  caseId: z.string().uuid(),
  entityId: z.string().uuid(),
  clientId: z.string().uuid(),
  label: z.string().min(1).max(200),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive(),
  storagePath: z.string().min(1),
  hash: z.string().min(1),
  checklistItemId: z.string().uuid().optional(),
  category: z
    .enum([
      "id_document",
      "proof_of_address",
      "bank_statement",
      "vat_return",
      "payroll_record",
      "accounts",
      "tax_return",
      "company_formation",
      "contract",
      "other",
    ])
    .optional()
    .default("other"),
});
export type RecordUploadInput = z.input<typeof recordUploadSchema>;

export const getUploadUrlSchema = z.object({
  caseId: z.string().uuid(),
  entityId: z.string().uuid(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
});
export type GetUploadUrlInput = z.input<typeof getUploadUrlSchema>;

export const verifyDocumentSchema = z.object({
  documentId: z.string().uuid(),
  notes: z.string().optional(),
});

export const overrideClassificationSchema = z.object({
  documentId: z.string().uuid(),
  classificationId: z.string().uuid(),
  category: z.enum([
    "id_document",
    "proof_of_address",
    "bank_statement",
    "vat_return",
    "payroll_record",
    "accounts",
    "tax_return",
    "company_formation",
    "contract",
    "other",
  ]),
  notes: z.string().optional(),
});

/* ── service functions ───────────────────────────────────────────────────── */

/**
 * Generate a signed Supabase Storage URL for direct browser upload.
 * Returns a placeholder path in dev mode (no live Supabase).
 */
export async function getUploadUrl(
  session: AuthSession,
  rawInput: GetUploadUrlInput,
): Promise<{ uploadUrl: string; storagePath: string }> {
  authorize(session, "upload_documents");
  const input = getUploadUrlSchema.parse(rawInput);

  const ext = input.filename.split(".").pop() ?? "bin";
  const storagePath = `entities/${input.entityId}/cases/${input.caseId}/docs/${Date.now()}.${ext}`;

  const uploadUrl = process.env["SUPABASE_URL"]
    ? `${process.env["SUPABASE_URL"]}/storage/v1/object/${storagePath}`
    : `/dev/storage/${storagePath}`;

  return { uploadUrl, storagePath };
}

/**
 * Record a completed document upload atomically:
 * document + version + checklist link (if provided) + audit + outbox event.
 */
export async function recordUpload(
  session: AuthSession,
  rawInput: RecordUploadInput,
): Promise<{ documentId: string }> {
  authorize(session, "upload_documents");
  const input = recordUploadSchema.parse(rawInput);

  const documentId = await withSession(session, async (tx) => {
    const doc = await insertDocument(tx, {
      entityId: input.entityId,
      caseId: input.caseId,
      clientId: input.clientId,
      checklistItemId: input.checklistItemId,
      label: input.label,
      category: input.category,
      status: "received",
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      storagePath: input.storagePath,
      hash: input.hash,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    await insertDocumentVersion(tx, {
      documentId: doc.id,
      versionNumber: 1,
      storagePath: input.storagePath,
      hash: input.hash,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      uploadedBy: session.userId,
    });

    if (input.checklistItemId) {
      await linkDocumentToChecklist(tx, doc.id, input.checklistItemId);
    }

    await insertAudit(tx, {
      entityId: input.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "document.uploaded",
      resourceType: "document",
      resourceId: doc.id,
      after: { label: input.label, mimeType: input.mimeType, caseId: input.caseId },
    });

    await emitEvent(tx, {
      entityId: input.entityId,
      type: "document.uploaded",
      payload: {
        documentId: doc.id,
        caseId: input.caseId,
        clientId: input.clientId,
        label: input.label,
        mimeType: input.mimeType,
        storagePath: input.storagePath,
      },
    });

    return doc.id;
  });

  return { documentId };
}

/**
 * List all documents for a case, each decorated with its latest classification.
 */
export async function listDocuments(session: AuthSession, caseId: string) {
  authorize(session, "view_documents");

  return withSession(session, async (tx) => {
    const docs = await listDocumentsByCase(tx, caseId);

    return Promise.all(
      docs.map(async (doc) => {
        const classifications = await listClassificationsByDocument(tx, doc.id);
        return { ...doc, latestClassification: classifications[0] ?? null };
      }),
    );
  });
}

/**
 * Store an AI classification result for a document (called after runAgent).
 */
export async function storeClassification(
  session: AuthSession,
  input: {
    documentId: string;
    entityId: string;
    category: string;
    confidence: number;
    reasoning: string;
    needsReview: boolean;
    source?: "auto" | "manual" | "agent";
  },
): Promise<void> {
  authorize(session, "upload_documents");

  await withSession(session, async (tx) => {
    const doc = await getDocumentById(tx, input.documentId);
    if (!doc) throw new NotFoundError(`Document not found: ${input.documentId}`);

    await insertClassification(tx, {
      documentId: input.documentId,
      source: input.source ?? "agent",
      category: input.category as never,
      confidence: String(input.confidence),
      reasoning: input.reasoning,
      needsReview: input.needsReview,
      metadata: {},
    });

    await updateDocument(tx, input.documentId, {
      category: input.category as never,
      status: input.needsReview ? "received" : "verified",
      updatedBy: session.userId,
    });
  });
}

/**
 * Staff verifies a document — marks as verified and records who did it.
 */
export async function verifyDocument(
  session: AuthSession,
  rawInput: z.input<typeof verifyDocumentSchema>,
): Promise<void> {
  authorize(session, "verify_documents");
  const input = verifyDocumentSchema.parse(rawInput);

  await withSession(session, async (tx) => {
    const doc = await getDocumentById(tx, input.documentId);
    if (!doc) throw new NotFoundError(`Document not found: ${input.documentId}`);

    await updateDocument(tx, input.documentId, {
      status: "verified",
      verifiedBy: session.userId,
      verifiedAt: new Date(),
      notes: input.notes,
      updatedBy: session.userId,
    });

    await insertAudit(tx, {
      entityId: doc.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "document.verified",
      resourceType: "document",
      resourceId: doc.id,
      after: { notes: input.notes ?? null },
    });
  });
}

/**
 * Staff overrides the AI classification for a document.
 */
export async function overrideClassification(
  session: AuthSession,
  rawInput: z.input<typeof overrideClassificationSchema>,
): Promise<void> {
  authorize(session, "verify_documents");
  const input = overrideClassificationSchema.parse(rawInput);

  await withSession(session, async (tx) => {
    const doc = await getDocumentById(tx, input.documentId);
    if (!doc) throw new NotFoundError(`Document not found: ${input.documentId}`);

    await confirmClassification(tx, input.classificationId, session.userId);

    await updateDocument(tx, input.documentId, {
      category: input.category as never,
      notes: input.notes,
      updatedBy: session.userId,
    });

    await insertAudit(tx, {
      entityId: doc.entityId,
      actorId: session.userId,
      actorType: "user",
      action: "document.classification_overridden",
      resourceType: "document",
      resourceId: doc.id,
      after: { newCategory: input.category, classificationId: input.classificationId },
    });
  });
}

/**
 * Deterministic gap analysis — compares checklist requirements vs received documents.
 * Returns blocking (required + missing) and non-blocking gaps.
 */
export async function getMissingDocuments(session: AuthSession, caseId: string) {
  authorize(session, "view_documents");

  return withSession(session, async (tx) => {
    const checklist = await listChecklist(tx, caseId);
    const docs = await listDocumentsByCase(tx, caseId);

    const linkedDocIds = new Set(docs.map((d) => d.checklistItemId).filter(Boolean) as string[]);

    const blocking: Array<{ id: string; key: string; label: string; category: string | null }> = [];
    const nonBlocking: Array<{ id: string; key: string; label: string }> = [];

    for (const item of checklist) {
      const isSatisfied =
        item.status === "received" ||
        item.status === "verified" ||
        item.status === "na" ||
        linkedDocIds.has(item.id);

      if (!isSatisfied) {
        if (item.required) {
          blocking.push({ id: item.id, key: item.key, label: item.label, category: item.category });
        } else {
          nonBlocking.push({ id: item.id, key: item.key, label: item.label });
        }
      }
    }

    const totalRequired = checklist.filter((i) => i.required).length;
    const satisfied = checklist.filter(
      (i) =>
        i.required &&
        (i.status === "received" || i.status === "verified" || i.status === "na"),
    ).length;

    return {
      blocking,
      nonBlocking,
      totalRequired,
      satisfied,
      allDocumentsReceived: blocking.length === 0,
      uploadedDocuments: docs,
    };
  });
}
