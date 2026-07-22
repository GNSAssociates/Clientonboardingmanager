import { NextRequest, NextResponse } from "next/server";
import { listDocuments, recordUpload } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();
    const docs = await listDocuments(session, params.id);
    return NextResponse.json({ data: docs });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getSession();
    if (!session) return unauthorized();
    const body = (await req.json()) as Record<string, unknown>;
    const result = await recordUpload(session, { ...body, caseId: params.id } as never);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
