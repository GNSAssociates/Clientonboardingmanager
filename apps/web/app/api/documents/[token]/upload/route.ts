import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, upsertDocumentSubmission } from "@gns/db";
import { getDocType } from "@/lib/document-types";

// Supabase Storage REST upload (no SDK needed)
async function uploadToSupabase(
  path: string,
  fileBuffer: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace("/rest/v1/", "").replace("/rest/v1", "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = "client-documents";

  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": mimeType,
      "x-upsert": "true",
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn("Supabase Storage upload failed:", err);
    // Return a placeholder URL so the flow continues even without Storage configured
    return `local://${path}`;
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = formData.get("docType") as string | null;

    if (!file || !docType) {
      return NextResponse.json({ error: "file and docType required" }, { status: 400 });
    }

    const docTypeDef = getDocType(docType);
    if (!docTypeDef) {
      return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
    }

    // Validate file type
    if (!docTypeDef.acceptedFormats.includes(file.type) && file.type !== "application/octet-stream") {
      return NextResponse.json({ error: `File type not accepted for ${docTypeDef.label}` }, { status: 400 });
    }

    // Validate file size
    const maxBytes = docTypeDef.maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `File too large. Maximum size: ${docTypeDef.maxSizeMb}MB` }, { status: 400 });
    }

    const db = getDb();
    const link = await db.transaction((tx) =>
      getOnboardingLinkByToken(tx, params.token)
    );
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Read file bytes
    const arrayBuffer = await file.arrayBuffer();

    // Build storage path
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${params.token}/${docType}_${Date.now()}_${safeName}`;

    const fileUrl = await uploadToSupabase(path, arrayBuffer, file.type);

    // Persist to DB
    const row = await db.transaction((tx) =>
      upsertDocumentSubmission(tx, params.token, docType, docTypeDef.label, {
        fileName: file.name,
        fileUrl,
        fileSizeBytes: file.size,
        mimeType: file.type,
      })
    );

    return NextResponse.json({
      success: true,
      docType,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      status: row.status,
    });
  } catch (err) {
    console.error("Document upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// Remove / reset a doc
export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { docType } = await req.json() as { docType: string };
    const db = getDb();
    const { removeDocumentSubmission } = await import("@gns/db");
    await db.transaction((tx) => removeDocumentSubmission(tx, params.token, docType));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Doc remove error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
