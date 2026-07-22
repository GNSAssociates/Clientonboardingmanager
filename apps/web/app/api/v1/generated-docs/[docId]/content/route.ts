import { NextRequest, NextResponse } from "next/server";
import { withSession } from "@gns/db";
import { getGeneratedDocById } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { unauthorized } from "@/lib/api";

/**
 * GET /api/v1/generated-docs/:docId/content
 * Serves the HTML content of a generated document (for e-sign PDF conversion or preview).
 * In production, the content would be fetched from Supabase Storage signed URL.
 */
export async function GET(_req: NextRequest, { params }: { params: { docId: string } }) {
  const session = getSession();
  if (!session) return unauthorized();

  const doc = await withSession(session, (tx) => getGeneratedDocById(tx, params.docId));
  if (!doc) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: doc.id,
      type: doc.type,
      templateKey: doc.templateKey,
      storagePath: doc.storagePath,
      mimeType: doc.mimeType,
      generatedAt: doc.generatedAt,
    },
  });
}
