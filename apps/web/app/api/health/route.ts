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
  // GoCardless credentials are per-firm (…_GNS / _LLP / _GALAXY) with a shared
  // default, so report whether ANY variant is present — enough to confirm a
  // deploy picked the variables up without revealing which firm or any value.
  const anyEnv = (base: string) =>
    ["", "_GNS", "_LLP", "_GALAXY"].some((suffix) => Boolean(process.env[`${base}${suffix}`]?.trim()));

  const configured = {
    database: Boolean(process.env.DATABASE_URL),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    // Mandate creation at signing.
    gocardlessToken: anyEnv("GOCARDLESS_ACCESS_TOKEN"),
    // Webhook signature verification — without this every GoCardless webhook
    // is rejected and Direct Debit clients stay stuck in "pending_dd".
    gocardlessWebhook: anyEnv("GOCARDLESS_WEBHOOK_SECRET"),
    gocardlessEnvironment: process.env.GOCARDLESS_ENVIRONMENT === "sandbox" ? "sandbox" : "live",
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
