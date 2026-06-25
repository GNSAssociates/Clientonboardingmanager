import { NextResponse, type NextRequest } from "next/server";
import { transitionCase, ValidationError } from "@gns/core";
import { CASE_STATUSES, type CaseStatus } from "@gns/config";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/cases/{id}/transition — guarded state change (FR-WF-1).
 * Illegal transitions return 409 ILLEGAL_TRANSITION via the state machine.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return unauthorized();
  try {
    const body = (await request.json()) as { to?: string; reason?: string };
    if (!body.to || !(CASE_STATUSES as readonly string[]).includes(body.to)) {
      throw new ValidationError("Invalid or missing 'to' status");
    }
    const data = await transitionCase(session, params.id, body.to as CaseStatus, body.reason);
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
