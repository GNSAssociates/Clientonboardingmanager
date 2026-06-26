import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adapters } from "@gns/integrations";
import {
  sendClearanceRequest,
  getClearanceSummary,
  SendClearanceRequestInput,
} from "@gns/core";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entityId = req.nextUrl.searchParams.get("entityId");
  if (!entityId) return NextResponse.json({ error: "entityId required" }, { status: 400 });

  try {
    const summary = await getClearanceSummary(session, params.id, entityId);
    return NextResponse.json(summary);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const input = SendClearanceRequestInput.parse({ ...body, caseId: params.id });

  const mailer = adapters.mailer!;

  try {
    const result = await sendClearanceRequest(session, input, mailer);
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
