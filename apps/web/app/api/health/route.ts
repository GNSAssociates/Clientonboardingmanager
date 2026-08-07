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
  // GoCardless credentials are per-firm (…_GNS / _LLP / _GALAXY, falling back
  // to a shared unsuffixed default). Reported per firm because the two halves
  // must be set together: a firm with an access token but no webhook secret
  // creates mandates that gate clients into "pending_dd", then rejects the very
  // webhook that would release them — leaving them stuck. Booleans only, never
  // values, so this stays safe to expose.
  const env = (name: string) => Boolean(process.env[name]?.trim());
  const gocardless = Object.fromEntries(
    ["GNS", "LLP", "GALAXY"].map((firm) => {
      const token = env(`GOCARDLESS_ACCESS_TOKEN_${firm}`) || env("GOCARDLESS_ACCESS_TOKEN");
      const webhook = env(`GOCARDLESS_WEBHOOK_SECRET_${firm}`) || env("GOCARDLESS_WEBHOOK_SECRET");
      return [firm.toLowerCase(), {
        token,
        webhook,
        // Only the token-without-secret combination is dangerous: mandates get
        // created (gating clients into pending_dd) but the confirming webhook
        // is rejected, so they never complete. The reverse is harmless — with
        // no token no mandate is created, so those clients simply finish
        // immediately, exactly as they did before Direct Debit gating existed.
        status: token && webhook ? "ok"
          : token ? "ACTION REQUIRED: access token set but no webhook secret — Direct Debit clients will stick in pending_dd"
          : webhook ? "inactive (webhook secret ready, no access token — Direct Debit gating off for this firm)"
          : "not configured (Direct Debit gating off for this firm)",
      }];
    }),
  );

  // Diagnostic: the NAMES of the GoCardless variables the process can actually
  // see (never their values). A variable that was saved but misspelled, or set
  // after the last restart, is otherwise indistinguishable from one that was
  // never set at all — this tells the two apart at a glance.
  const gocardlessVarsSeen = Object.keys(process.env)
    .filter((k) => k.toUpperCase().startsWith("GOCARDLESS"))
    .sort();

  const configured = {
    database: Boolean(process.env.DATABASE_URL),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    gocardlessEnvironment: process.env.GOCARDLESS_ENVIRONMENT === "sandbox" ? "sandbox" : "live",
    gocardless,
    gocardlessVarsSeen,
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
