import { NextRequest, NextResponse } from "next/server";
import { initiateKyc, updateKycResult } from "@gns/core";
import { adapters } from "@gns/integrations";
import { IntegrationError } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

/** POST /api/v1/cases/:id/compliance/kyc — initiate a KYC check */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();

    if (!adapters.kyc) throw new IntegrationError("kyc", "KYC provider not configured");

    const body = (await req.json()) as Record<string, unknown>;
    const check = await initiateKyc(
      session,
      { ...body, caseId: params.id } as never,
      adapters.kyc,
    );
    return NextResponse.json({ data: check }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

/** PATCH /api/v1/cases/:id/compliance/kyc — poll/update a KYC check result */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();

    if (!adapters.kyc) throw new IntegrationError("kyc", "KYC provider not configured");

    const body = (await req.json()) as { checkId: string; entityId: string };
    const updated = await updateKycResult(
      session,
      body.checkId,
      params.id,
      body.entityId,
      adapters.kyc,
    );
    return NextResponse.json({ data: updated });
  } catch (e) {
    return apiError(e);
  }
}
