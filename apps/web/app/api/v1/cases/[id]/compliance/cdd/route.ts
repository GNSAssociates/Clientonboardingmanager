import { NextRequest, NextResponse } from "next/server";
import { recordCdd } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

/** POST /api/v1/cases/:id/compliance/cdd — record a CDD decision */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();

    const body = (await req.json()) as Record<string, unknown>;
    const record = await recordCdd(session, { ...body, caseId: params.id } as never);
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
