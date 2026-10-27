import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, upsertDocumentSubmission, getDocumentCompletionStatus } from "@gns/db";
import { getDocType, REQUIRED_DOC_IDS } from "@/lib/document-types";
import { archiveToClientFolder } from "@/lib/storage";
import { moveClientFolderToStage } from "@/lib/onedrive";
import { putDocument } from "@/lib/doc-store";

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

    // Two destinations, and the upload survives either one failing. The file is
    // kept on this server's own disk, and archived into the client's OneDrive
    // folder because that is where the practice expects every client document
    // to be. Neither is allowed to abort the other: a drive that could not be
    // reached used to mean the director's ID went nowhere at all.
    let fileUrl = "";
    let storageConfigured = false;
    let lastError = "";

    try {
      fileUrl = await putDocument(path, arrayBuffer);
      storageConfigured = true;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error("Writing the document to this server failed, trying OneDrive:", lastError);
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
        // If the disk write failed, the drive is where the document actually
        // is, so that is what the row has to point at.
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
