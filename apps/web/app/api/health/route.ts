import { NextRequest, NextResponse } from "next/server";
import { createConnection } from "@gns/db";
import { newRequestId } from "@/lib/observability";
import { environmentForFirm } from "@/lib/gocardless";

export const dynamic = "force-dynamic";

/**
 * Liveness/health endpoint (A2 §11, NFR-OBS-1). Reports service status and
 * which integration credentials are configured (booleans only — never values).
 * Used by uptime checks and the deploy smoke test.
 */
/**
 * IS THE DATABASE ACTUALLY ANSWERING?
 *
 * Everything else on this endpoint reports whether a variable is SET, which is
 * a different question from whether the thing works — a rotated password, a
 * paused Supabase project or an IP block all leave the variables looking
 * perfect. This opens a connection and asks the server what it is.
 *
 * Only on ?deep=1, because uptime checks hit /api/health constantly and none of
 * them should be opening database connections. Returns the host, the server
 * version and the round-trip time; on failure, the error CLASS only — never the
 * connection string, and never the raw driver message, which can carry
 * credentials.
 */
async function probeDatabase(): Promise<Record<string, unknown>> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return { ok: false, reason: "DATABASE_URL is not set" };

  const started = Date.now();
  let sql: ReturnType<typeof createConnection> | null = null;
  try {
    sql = createConnection(url);
    const rows = (await Promise.race([
      sql`select version() as v, current_database() as db`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ])) as Array<{ v?: string; db?: string }>;
    const row = rows?.[0] ?? {};
    return {
      ok: true,
      database: row.db ?? null,
      server: String(row.v ?? "").split(",")[0] || null,
      roundTripMs: Date.now() - started,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Say WHICH kind of failure without quoting anything that may hold secrets.
    const reason =
      /timeout/i.test(msg) ? "timed out — the database did not answer in 8s"
      : /password|auth/i.test(msg) ? "authentication rejected — the password or user is wrong"
      : /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg) ? "host not found — check the connection string"
      : /ECONNREFUSED|ETIMEDOUT|ENETUNREACH/i.test(msg) ? "connection refused — the project may be paused, or this IP is blocked"
      : /does not exist/i.test(msg) ? "the named database does not exist"
      : "connection failed";
    return { ok: false, reason, afterMs: Date.now() - started };
  } finally {
    try { await sql?.end({ timeout: 1 }); } catch { /* closing is best-effort */ }
  }
}

export async function GET(req: NextRequest) {
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
        // The environment is per-firm too; a sandbox token on the live API
        // 401s on every call, and the reverse creates real mandates.
        environment: environmentForFirm(firm.toLowerCase()),
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
  const supabaseVarsSeen = Object.keys(process.env)
    .filter((k) => k.toUpperCase().includes("SUPABASE"))
    .sort();

  /* WHICH database is live. The Supabase dashboard shows a project ref; this
     shows the ref the running app is actually connected to, so the two can be
     compared without guessing. HOST ONLY — the user, password and query string
     are dropped, so this stays as safe to expose as the booleans around it. */
  let databaseHost: string | null = null;
  try {
    const raw = process.env.DATABASE_URL?.trim();
    if (raw) databaseHost = new URL(raw).hostname;
  } catch { databaseHost = "unparseable"; }

  const configured = {
    database: Boolean(process.env.DATABASE_URL),
    databaseHost,
    // Signs the staff auth cookies AND the client's 30-minute 2FA session on a
    // signing link. Without it that session cannot be verified, so clients are
    // asked for a fresh code on every single refresh.
    authSecret: Boolean(process.env.AUTH_SHIM_SECRET?.trim()),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    // Document uploads use these server-side names (NOT NEXT_PUBLIC_*), so the
    // health flag must check the same ones the upload route reads.
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseVarsSeen,
    gocardlessEnvironment: process.env.GOCARDLESS_ENVIRONMENT === "sandbox" ? "sandbox" : "live",
    gocardless,
    gocardlessVarsSeen,
  };
  // ?deep=1 turns the "is it configured" answers into "does it work" answers.
  const deep = req.nextUrl.searchParams.get("deep") === "1";
  const live = deep ? { database: await probeDatabase() } : undefined;

  return NextResponse.json(
    {
      status: "ok",
      service: "gns-onboarding-web",
      time: new Date().toISOString(),
      configured,
      ...(live ? { live } : {}),
    },
    { headers: { "x-request-id": requestId } },
  );
}
