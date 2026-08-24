import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, upsertDocumentSubmission, getDocumentCompletionStatus } from "@gns/db";
import { getDocType, REQUIRED_DOC_IDS } from "@/lib/document-types";
import { archiveToClientFolder } from "@/lib/storage";
import { moveClientFolderToStage } from "@/lib/onedrive";

// Supabase Storage REST upload (no SDK needed)
async function uploadToSupabase(
  path: string,
  fileBuffer: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace("/rest/v1/", "").replace("/rest/v1", "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = "client-documents";

  if (!supabaseUrl || !serviceKey) {
    // Not an error any more: this deployment may archive to OneDrive instead.
    // The caller decides what to do when no Supabase bucket is configured.
    return "";
  }

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
    console.error("Supabase Storage upload failed:", res.status, err);
    // Surface the real reason instead of silently saving an unusable placeholder.
    throw new Error(`Storage upload failed (${res.status}). ${err.slice(0, 160)}`);
  }

  // These are KYC/ID documents, so the bucket must stay PRIVATE. Return a signed
  // URL (valid 1 year) instead of a public URL so staff can view the file
  // without the object being world-readable.
  const signRes = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
  });
  const signJson = (await signRes.json().catch(() => ({}))) as { signedURL?: string };
  if (signRes.ok && signJson.signedURL) {
    return `${supabaseUrl}/storage/v1${signJson.signedURL.replace(/^\/storage\/v1/, "")}`;
  }
  // Fall back to the object path if signing is unavailable (still not public).
  return `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
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

    // Validate file type — accept by MIME OR by file extension (phones often
    // send an empty or generic type, e.g. HEIC photos), so genuine documents
    // are not wrongly rejected.
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const extOk = ["pdf", "jpg", "jpeg", "png", "heic", "heif", "webp", "gif", "doc", "docx"].includes(ext);
    const typeOk = docTypeDef.acceptedFormats.includes(file.type) || file.type === "application/octet-stream" || !file.type;
    if (!typeOk && !extOk) {
      return NextResponse.json({ error: `File type not accepted for ${docTypeDef.label}. Please upload a PDF or image.` }, { status: 400 });
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

    // Two possible destinations. Supabase Storage is used when configured;
    // otherwise the client's OneDrive folder IS the store, not just a mirror.
    // Previously an unconfigured Supabase threw before OneDrive was even
    // attempted, so on this deployment the director could never upload their ID
    // at all — the file went nowhere and the portal just failed.
    let fileUrl = "";
    let storageConfigured = false;
    let lastError = "";

    try {
      fileUrl = await uploadToSupabase(path, arrayBuffer, file.type);
      if (fileUrl) storageConfigured = true;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error("Supabase upload failed, will try OneDrive:", lastError);
    }

    // Always archive to the client's OneDrive folder when it is configured —
    // that is where the practice expects every client document to live.
    try {
      const archived = await archiveToClientFolder({
        companyName: link.companyName ?? params.token.substring(0, 8),
        fileName: `${docTypeDef.label} - ${safeName}`,
        content: arrayBuffer,
        mimeType: file.type,
      });
      if (archived) {
        storageConfigured = true;
        // With no Supabase bucket, record the OneDrive location so staff can
        // still find the document from the client's record.
        if (!fileUrl) fileUrl = `onedrive:${archived.path}`;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error("OneDrive archive failed:", lastError);
    }

    if (!storageConfigured) {
      // Nowhere to put it. Say so plainly rather than recording a document we
      // did not actually keep.
      return NextResponse.json(
        {
          error:
            "We could not store your document because no document storage is configured on the server. " +
            "Please contact us so we can collect it another way." +
            (lastError ? ` (${lastError.slice(0, 160)})` : ""),
        },
        { status: 503 },
      );
    }

    // Persist to DB
    const row = await db.transaction((tx) =>
      upsertDocumentSubmission(tx, params.token, docType, docTypeDef.label, {
        fileName: file.name,
        fileUrl,
        fileSizeBytes: file.size,
        mimeType: file.type,
      })
    );

    // Once every required ID document is in, advance the client's OneDrive folder
    // to "02 Client Info Received" so the drive reflects the same stage the app
    // shows. Best-effort: never fail an upload because the drive was unreachable.
    try {
      const completion = await db.transaction((tx) =>
        getDocumentCompletionStatus(tx, params.token, REQUIRED_DOC_IDS)
      );
      if (completion.isComplete) {
        const moved = await moveClientFolderToStage(link.companyName ?? "", "info_received");
        if (!moved.moved && moved.reason) {
          console.warn("Stage move skipped:", moved.reason);
        }
      }
    } catch (e) {
      console.error("Stage move failed (upload still saved):", e);
    }

    return NextResponse.json({
      success: true,
      docType,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      status: row.status,
    });
  } catch (err) {
    console.error("Document upload error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
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
