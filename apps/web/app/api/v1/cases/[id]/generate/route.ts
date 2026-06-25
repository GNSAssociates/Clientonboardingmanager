import { NextRequest, NextResponse } from "next/server";
import { generateLetter } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

/** POST /api/v1/cases/:id/generate — generate an auth or engagement letter */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();

    const body = (await req.json()) as Record<string, unknown>;
    const result = await generateLetter(session, { ...body, caseId: params.id } as never);

    return NextResponse.json({ data: { docId: result.docId } }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
