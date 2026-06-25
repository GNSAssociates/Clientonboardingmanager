import { NextRequest, NextResponse } from "next/server";
import { listGeneratedDocsForCase, sendForSigning } from "@gns/core";
import { adapters } from "@gns/integrations";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";
import { IntegrationError } from "@gns/core";

/** GET /api/v1/cases/:id/esign — list envelopes for a case */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();
    const result = await listGeneratedDocsForCase(session, params.id);
    return NextResponse.json({ data: result });
  } catch (e) {
    return apiError(e);
  }
}

/** POST /api/v1/cases/:id/esign — send a document for signature */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();

    if (!adapters.esign) throw new IntegrationError("esign", "No e-sign provider configured");

    const body = (await req.json()) as Record<string, unknown>;
    const result = await sendForSigning(
      session,
      { ...body, caseId: params.id } as never,
      adapters.esign,
    );
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
