import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Document-storage diagnostics (operator-only).
 *
 * Client ID uploads need somewhere to go: Supabase Storage, or the client's
 * OneDrive folder. The cPanel environment box silently drops variables, so a
 * missing key is invisible from outside — and when Supabase was unset the
 * director's upload simply failed with no way to see why.
 *
 * Reports which destinations the RUNNING process can see (booleans only, never
 * values) and, with &probe=1, actually calls each service so a wrong key shows
 * up as a real error rather than "configured".
 *
 * Locked with AUTH_SHIM_SECRET, passed as ?key= — same pattern as
 * /api/health/mail. Returns 404 when unset or wrong, so it is invisible to
 * probing.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.AUTH_SHIM_SECRET ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!secret || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const supabaseConfigured = Boolean(supabaseUrl && serviceKey);

  const graphConfigured = Boolean(
    (process.env.ENTRA_TENANT_ID?.trim() || process.env.MS_GRAPH_TENANT_ID?.trim()) &&
      (process.env.ENTRA_CLIENT_ID?.trim() || process.env.MS_GRAPH_CLIENT_ID?.trim()) &&
      (process.env.ENTRA_CLIENT_SECRET?.trim() || process.env.MS_GRAPH_CLIENT_SECRET?.trim()),
  );

  const result: Record<string, unknown> = {
    supabase: { configured: supabaseConfigured, hasUrl: Boolean(supabaseUrl), hasServiceKey: Boolean(serviceKey) },
    onedrive: { configured: graphConfigured },
    canAcceptUploads: supabaseConfigured || graphConfigured,
  };

  if (req.nextUrl.searchParams.get("probe") === "1") {
    // Supabase: list the bucket. Proves the URL AND the key actually work.
    if (supabaseConfigured) {
      try {
        const r = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        });
        const body = await r.text();
        (result.supabase as Record<string, unknown>).probe = r.ok
          ? { ok: true, buckets: (JSON.parse(body) as Array<{ name: string }>).map((b) => b.name) }
          : { ok: false, status: r.status, error: body.slice(0, 200) };
      } catch (e) {
        (result.supabase as Record<string, unknown>).probe = {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }

    // OneDrive: fetch a Graph token and check the drive responds.
    if (graphConfigured) {
      try {
        const { probeOneDrive } = await import("@/lib/onedrive");
        (result.onedrive as Record<string, unknown>).probe = await probeOneDrive();
      } catch (e) {
        (result.onedrive as Record<string, unknown>).probe = {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
  }

  return NextResponse.json(result);
}
