import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getOnboardingLinkByToken,
  getDocumentSubmissions,
  initDocumentSubmissions,
} from "@gns/db";
import { DOCUMENT_TYPES } from "@/lib/document-types";

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
          fileUrl: row?.fileUrl ?? null,
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
    console.error("Documents GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
