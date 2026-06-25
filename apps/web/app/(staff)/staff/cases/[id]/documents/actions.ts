"use server";

import { revalidatePath } from "next/cache";
import { recordUpload, verifyDocument, overrideClassification } from "@gns/core";
import { requireCapability } from "@/lib/auth/session";

export async function recordUploadAction(formData: FormData) {
  const session = requireCapability("upload_documents");

  const caseId = formData.get("caseId") as string;
  const entityId = formData.get("entityId") as string;
  const clientId = formData.get("clientId") as string;
  const label = formData.get("label") as string;
  const mimeType = (formData.get("mimeType") as string) || "application/octet-stream";
  const storagePath = (formData.get("storagePath") as string) || `dev/placeholder/${Date.now()}`;
  const hash = (formData.get("hash") as string) || `sha256:dev-${Date.now()}`;
  const fileSize = Number(formData.get("fileSize") || 0);
  const checklistItemId = (formData.get("checklistItemId") as string) || undefined;
  const category = (formData.get("category") as string) || "other";

  await recordUpload(session, {
    caseId,
    entityId,
    clientId,
    label,
    mimeType,
    fileSize,
    storagePath,
    hash,
    checklistItemId: checklistItemId || undefined,
    category: category as never,
  });

  revalidatePath(`/staff/cases/${caseId}/documents`);
}

export async function verifyDocumentAction(formData: FormData) {
  const session = requireCapability("verify_documents");

  const documentId = formData.get("documentId") as string;
  const caseId = formData.get("caseId") as string;
  const notes = (formData.get("notes") as string) || undefined;

  await verifyDocument(session, { documentId, notes });
  revalidatePath(`/staff/cases/${caseId}/documents`);
}

export async function overrideClassificationAction(formData: FormData) {
  const session = requireCapability("verify_documents");

  const documentId = formData.get("documentId") as string;
  const classificationId = formData.get("classificationId") as string;
  const category = formData.get("category") as string;
  const caseId = formData.get("caseId") as string;

  await overrideClassification(session, {
    documentId,
    classificationId,
    category: category as never,
  });

  revalidatePath(`/staff/cases/${caseId}/documents`);
}
