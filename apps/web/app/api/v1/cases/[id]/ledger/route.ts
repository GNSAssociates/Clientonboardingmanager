import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adapters } from "@gns/integrations";
import { pullLedgerSnapshot, getIntegrationSummary, PullLedgerInput } from "@gns/core";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  try {
    const summary = await getIntegrationSummary(session, clientId, params.id);
    return NextResponse.json(summary);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const input = PullLedgerInput.parse({ ...body, caseId: params.id });

  const provider = input.connectionId ? body.provider as "xero" | "qbo" : "xero";
  const ledger = adapters.ledger?.[provider];
  if (!ledger) return NextResponse.json({ error: `${provider} adapter not found` }, { status: 400 });

  try {
    const result = await pullLedgerSnapshot(session, input, ledger);
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
