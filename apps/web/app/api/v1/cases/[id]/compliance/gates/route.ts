import { NextRequest, NextResponse } from "next/server";
import { approveComplianceGate } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

/** POST /api/v1/cases/:id/compliance/gates — approve or override a compliance gate */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();

    const body = (await req.json()) as Record<string, unknown>;
    const gate = await approveComplianceGate(
      session,
      { ...body, caseId: params.id } as never,
    );
    return NextResponse.json({ data: gate }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
