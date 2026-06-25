import { NextRequest, NextResponse } from "next/server";
import { voidEnvelope } from "@gns/core";
import { adapters } from "@gns/integrations";
import { IntegrationError } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

/** PATCH /api/v1/cases/:id/esign/:envelopeId — void an envelope */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; envelopeId: string } },
) {
  try {
    const session = getSession();
    if (!session) return unauthorized();

    const body = (await req.json()) as { action?: string };
    if (body.action !== "void") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "action must be 'void'" } },
        { status: 422 },
      );
    }

    if (!adapters.esign) throw new IntegrationError("esign", "No e-sign provider configured");

    await voidEnvelope(session, params.envelopeId, adapters.esign);
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return apiError(e);
  }
}
