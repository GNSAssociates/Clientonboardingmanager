import { NextResponse } from "next/server";
import { getCaseDetail } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/cases/{id} — case aggregate (status, checklist, services). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return unauthorized();
  try {
    const data = await getCaseDetail(session, params.id);
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
