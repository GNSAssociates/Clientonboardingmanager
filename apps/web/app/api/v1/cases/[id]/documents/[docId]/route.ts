import { NextRequest, NextResponse } from "next/server";
import { verifyDocument, overrideClassification, getMissingDocuments } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

/** PATCH /api/v1/cases/:id/documents/:docId — verify or override classification */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } },
) {
  try {
    const session = getSession();
    if (!session) return unauthorized();
    const body = (await req.json()) as { action?: string; [k: string]: unknown };

    if (body.action === "verify") {
      await verifyDocument(session, {
        documentId: params.docId,
        notes: body.notes as string | undefined,
      });
    } else if (body.action === "override_classification") {
      await overrideClassification(session, {
        documentId: params.docId,
        classificationId: body.classificationId as string,
        category: body.category as never,
        notes: body.notes as string | undefined,
      });
    } else {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Unknown action" } },
        { status: 422 },
      );
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return apiError(e);
  }
}

/** GET /api/v1/cases/:id/documents/gaps — missing document analysis */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } },
) {
  if (params.docId === "gaps") {
    try {
      const session = getSession();
      if (!session) return unauthorized();
      const result = await getMissingDocuments(session, params.id);
      return NextResponse.json({ data: result });
    } catch (e) {
      return apiError(e);
    }
  }

  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: "Not found" } },
    { status: 404 },
  );
}
