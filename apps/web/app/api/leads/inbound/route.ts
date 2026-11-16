/**
 * Website enquiries arrive here, sent by WordPress the moment a visitor
 * submits a form.
 *
 * Sender: the GNS Leads Bridge plugin (docs/wordpress/gns-leads-bridge.php),
 * or the WPForms Webhooks add-on / Zapier pointed at the same address. There
 * is no user session: the request carries the shared secret in the
 * `X-GNS-Leads-Secret` header (or `Authorization: Bearer …`).
 *
 *   POST /api/leads/inbound?firm=gns|llp|galaxy
 *
 * The firm says which practice's website the enquiry came from, so a Galaxy
 * enquiry is not answered on GNS letterhead.
 *
 * Accepts JSON or a classic form post. Answers 201 for a new lead, 200 for a
 * repeat of one already stored (so WordPress stops retrying), 401 for a wrong
 * secret, 503 when the server has no secret configured.
 */
import { NextRequest, NextResponse } from "next/server";
import { parseLead } from "@/lib/lead-parse";
import { insertLead } from "@/lib/lead-store";
import { checkLeadsSecret, leadsSecretConfigured } from "@/lib/leads-auth";
import { FIRMS } from "@/lib/firms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A contact form is a few kilobytes. Anything this size is not an enquiry. */
const MAX_BODY = 64 * 1024;

function presentedSecret(req: NextRequest): string | null {
  const h = req.headers.get("x-gns-leads-secret");
  if (h) return h;
  const auth = req.headers.get("authorization");
  return auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
}

export async function POST(req: NextRequest) {
  if (!leadsSecretConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!checkLeadsSecret(presentedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const text = await req.text();
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let body: unknown;
  const type = req.headers.get("content-type") ?? "";
  try {
    body = type.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries(new URLSearchParams(text))
      : JSON.parse(text || "{}");
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const firmParam = req.nextUrl.searchParams.get("firm");
  const firmSlug = firmParam && firmParam in FIRMS ? firmParam : null;

  try {
    const parsed = parseLead(body);
    const { id, created } = await insertLead(parsed, { source: "website", firmSlug, raw: body });
    return NextResponse.json(
      { ok: true, id, duplicate: !created, filedAsSpam: parsed.looksLikeSpam },
      { status: created ? 201 : 200 },
    );
  } catch (e) {
    console.error("inbound lead failed:", e);
    // 500 tells the bridge to keep the enquiry and try again later.
    return NextResponse.json({ error: "could_not_store" }, { status: 500 });
  }
}

/**
 * A connection test for whoever sets up the website: with the right secret it
 * says so; without one it only says whether the server is ready. It never
 * reveals the secret or any lead.
 */
export async function GET(req: NextRequest) {
  const configured = leadsSecretConfigured();
  const presented = presentedSecret(req);
  return NextResponse.json({
    endpoint: "gns-leads",
    configured,
    authorised: presented ? configured && checkLeadsSecret(presented) : undefined,
  });
}
