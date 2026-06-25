import { NextResponse } from "next/server";
import { newRequestId } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * Liveness/health endpoint (A2 §11, NFR-OBS-1). Reports service status and
 * which integration credentials are configured (booleans only — never values).
 * Used by uptime checks and the deploy smoke test.
 */
export function GET() {
  const requestId = newRequestId();
  const configured = {
    database: Boolean(process.env.DATABASE_URL),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  };
  return NextResponse.json(
    {
      status: "ok",
      service: "gns-onboarding-web",
      time: new Date().toISOString(),
      configured,
    },
    { headers: { "x-request-id": requestId } },
  );
}
