import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adapters } from "@gns/integrations";
import { connectIntegration } from "@gns/core";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.redirect(new URL("/dev-login", req.url));

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";
  const entityId = session.entityIds[0];
  const clientId = searchParams.get("clientId") ?? state.split(":")[0] ?? "";

  if (!code || !entityId) {
    return NextResponse.redirect(new URL("/staff?error=qbo_callback_missing_params", req.url));
  }

  try {
    const qbo = adapters.ledger?.["qbo"];
    if (!qbo) throw new Error("QBO adapter not registered");
    await connectIntegration(
      session,
      { entityId, clientId, provider: "qbo", code, state },
      qbo,
    );
    return NextResponse.redirect(new URL(`/staff?notice=qbo_connected`, req.url));
  } catch (e: unknown) {
    const msg = encodeURIComponent(e instanceof Error ? e.message : "unknown");
    return NextResponse.redirect(new URL(`/staff?error=${msg}`, req.url));
  }
}
