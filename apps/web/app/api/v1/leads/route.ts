import { NextResponse, type NextRequest } from "next/server";
import { createLead, createLeadSchema } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/v1/leads — intake → creates client + onboarding case (FR-LEAD-2). */
export async function POST(request: NextRequest) {
  const session = getSession();
  if (!session) return unauthorized();
  try {
    const input = createLeadSchema.parse(await request.json());
    const data = await createLead(session, input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
