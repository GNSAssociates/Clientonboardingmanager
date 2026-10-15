import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getOnboardingLinkByToken,
  getDocumentSubmissions,
  initDocumentSubmissions,
} from "@gns/db";
import { DOCUMENT_TYPES } from "@/lib/document-types";

/** How long a link to someone's passport should live. Minutes, not months. */
const VIEW_MINUTES = Number(process.env.DOCUMENT_LINK_MINUTES || 15);

/**
 * Turn a stored reference into a link that works for a few minutes.
 *
 * Rows written before this change hold a full https URL signed for a year;
 * those are returned as they are, because the link already exists and cannot be
 * un-issued — but nothing new is created that way. Anything stored as
 * "supabase:bucket/path" is signed here, on request, and expires shortly after.
 */
async function signDocumentUrl(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (!ref.startsWith("supabase:")) return ref;          // legacy URL, or onedrive:

  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey) return null;

  const [bucket, ...rest] = ref.slice("supabase:".length).split("/");
  const path = rest.join("/");
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: VIEW_MINUTES * 60 }),
    });
    const json = (await res.json().catch(() => ({}))) as { signedURL?: string };
    if (res.ok && json.signedURL) {
      return `${supabaseUrl}/storage/v1${json.signedURL.replace(/^\/storage\/v1/, "")}`;
    }
  } catch {
    /* a document that cannot be signed is simply not shown */
  }
  return null;
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
      docs: await Promise.all(DOCUMENT_TYPES.map(async (dt) => {
        const row = rows.find((r) => r.docType === dt.id);
        return {
          ...dt,
          status: row?.status ?? "pending",
          fileName: row?.fileName ?? null,
          // Signed now, for minutes — not a year-old link read out of a row.
          fileUrl: await signDocumentUrl(row?.fileUrl),
          fileSizeBytes: row?.fileSizeBytes ?? null,
          uploadedAt: row?.uploadedAt ?? null,
        };
      })),
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
