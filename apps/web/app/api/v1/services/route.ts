import { NextResponse } from "next/server";
import { listServicesForSession } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/services — active service catalogue (FR-SVC-1). */
export async function GET() {
  const session = getSession();
  if (!session) return unauthorized();
  try {
    const data = await listServicesForSession(session);
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
