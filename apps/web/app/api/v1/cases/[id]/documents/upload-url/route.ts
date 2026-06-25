import { NextRequest, NextResponse } from "next/server";
import { getUploadUrl } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();
    const body = (await req.json()) as Record<string, unknown>;
    const result = await getUploadUrl(session, { ...body, caseId: params.id } as never);
    return NextResponse.json({ data: result });
  } catch (e) {
    return apiError(e);
  }
}
