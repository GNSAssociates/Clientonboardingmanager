import { NextResponse, type NextRequest } from "next/server";
import { selectServices, selectServicesSchema } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/v1/cases/{id}/services — select services for the case (FR-SVC-2). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return unauthorized();
  try {
    const input = selectServicesSchema.parse(await request.json());
    const data = await selectServices(session, params.id, input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
