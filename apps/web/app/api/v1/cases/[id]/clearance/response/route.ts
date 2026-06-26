import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { recordClearanceResponse, RecordClearanceResponseInput } from "@gns/core";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const input = RecordClearanceResponseInput.parse(body);

  try {
    await recordClearanceResponse(session, input);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
