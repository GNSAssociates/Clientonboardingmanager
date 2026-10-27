import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getOnboardingLinkByToken,
  getDocumentSubmissions,
  initDocumentSubmissions,
} from "@gns/db";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { signLocalUrl } from "@/lib/doc-store";

/**
 * Turn a stored reference into a link that works for a few minutes.
 *
 * Documents kept on this server are stored as "local:path" and signed here, on
 * request. Rows written before any of this hold a full https URL that was
 * signed for a year; those are returned as they are, because the link already
 * exists and cannot be un-issued — but nothing new is ever created that way.
 *
 * "supabase:..." refs are deliberately not handled. Every one of them was
 * rewritten when the files moved onto this server, so a row still holding one
 * means something went wrong in that migration and the right answer is to show
 * nothing rather than a broken link.
 */
function signDocumentUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith("local:")) return signLocalUrl(ref);
  if (ref.startsWith("supabase:")) {
    console.error("document row still points at Supabase storage:", ref);
    return null;
  }
  return ref; // legacy signed URL, or onedrive:
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const db = getDb();
    const link = await db.transaction((tx) =>
      getOnboardingLinkByToken(tx, params.token)
    );
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Auto-initialise pending rows for all doc types
    const rows = await db.transaction((tx) =>
      initDocumentSubmissions(
        tx,
        params.token,
        DOCUMENT_TYPES.map((d) => ({ id: d.id, label: d.label })),
      )
    );

    const uploadedIds = rows.filter((r) => r.status === "uploaded").map((r) => r.docType);
    const requiredIds = DOCUMENT_TYPES.filter((d) => d.required).map((d) => d.id);
    const missingRequired = requiredIds.filter((id) => !uploadedIds.includes(id));

    return NextResponse.json({
      companyName: link.companyName,
      companyNumber: link.companyNumber,
      directorName: link.directorName,
      firmSlug: link.firmSlug,
      docs: DOCUMENT_TYPES.map((dt) => {
        const row = rows.find((r) => r.docType === dt.id);
        return {
          ...dt,
          status: row?.status ?? "pending",
          fileName: row?.fileName ?? null,
          // Signed now, for minutes — not a year-old link read out of a row.
          fileUrl: signDocumentUrl(row?.fileUrl),
          fileSizeBytes: row?.fileSizeBytes ?? null,
          uploadedAt: row?.uploadedAt ?? null,
        };
      }),
      summary: {
        total: DOCUMENT_TYPES.length,
        required: requiredIds.length,
        uploaded: uploadedIds.length,
        missingRequired,
        isComplete: missingRequired.length === 0,
      },
    });
  } catch (err) {
    // Surface the real reason. This page used to swallow every failure as
    // "link invalid or expired", which hid a genuine server fault from both the
    // client and us for a long time.
    console.error("Documents GET error:", err);
    return NextResponse.json(
      {
        error: "server_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
