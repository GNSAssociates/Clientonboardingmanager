import { NextResponse, type NextRequest } from "next/server";
import { listCasesForSession } from "@gns/core";
import { CASE_STATUSES, type CaseStatus } from "@gns/config";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/cases?status=&assignedTo= — pipeline list (FR-WF-1, A4 §5.2). */
export async function GET(request: NextRequest) {
  const session = getSession();
  if (!session) return unauthorized();
  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status") ?? undefined;
    const status =
      statusParam && (CASE_STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as CaseStatus)
        : undefined;
    const data = await listCasesForSession(session, {
      status,
      assignedTo: url.searchParams.get("assignedTo") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
