import { NextRequest, NextResponse } from "next/server";
import { getComplianceSummary, verifyCompany } from "@gns/core";
import { adapters } from "@gns/integrations";
import { IntegrationError } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

/** GET /api/v1/cases/:id/compliance — full compliance summary */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();
    const data = await getComplianceSummary(session, params.id);
    return NextResponse.json({ data });
  } catch (e) {
    return apiError(e);
  }
}

/** POST /api/v1/cases/:id/compliance — verify company via Companies House */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();

    if (!adapters.companiesHouse) {
      throw new IntegrationError("companies_house", "Companies House adapter not configured");
    }

    const body = (await req.json()) as Record<string, unknown>;
    const record = await verifyCompany(
      session,
      { ...body, caseId: params.id } as never,
      adapters.companiesHouse,
    );
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
