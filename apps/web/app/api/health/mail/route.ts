import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendMailResult } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Mail diagnostics (operator-only).
 *
 * The cPanel env box silently drops variables, so email breakage is usually a
 * missing env var — but that's invisible from outside. This endpoint reports
 * which mail providers the RUNNING process can actually see (booleans only,
 * never values) and, with &send=1, attempts a real test send and returns the
 * exact provider error.
 *
 * Locked with the AUTH_SHIM_SECRET (already set on the server): pass it as
 * the `key` query param. Constant-time comparison; 404 when unset/wrong so the
 * endpoint is invisible to probing.
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

  const cfg = {
    graph: {
      ready: !!(
        (process.env.ENTRA_TENANT_ID?.trim() || process.env.MS_GRAPH_TENANT_ID?.trim()) &&
        (process.env.ENTRA_CLIENT_ID?.trim() || process.env.MS_GRAPH_CLIENT_ID?.trim()) &&
        (process.env.ENTRA_CLIENT_SECRET?.trim() || process.env.MS_GRAPH_CLIENT_SECRET?.trim())
      ),
      // Head of the client id in use, to confirm it matches the app that was
      // granted Mail.Send in Entra.
      clientIdHead: ((process.env.ENTRA_CLIENT_ID ?? process.env.MS_GRAPH_CLIENT_ID) ?? "").slice(0, 8),
      sender: process.env.GRAPH_MAIL_SENDER ?? process.env.MS_GRAPH_USER ?? process.env.MAIL_FROM_EMAIL ?? "info@gnsassociates.co.uk",
    },
    smtp: {
      host: !!process.env.SMTP_HOST?.trim(),
      port: process.env.SMTP_PORT ?? "(default 587)",
      user: !!process.env.SMTP_USER?.trim(),
      password: !!process.env.SMTP_PASSWORD,
    },
    smtp2go: !!process.env.SMTP2GO_API_KEY?.trim(),
    brevo: !!process.env.BREVO_API_KEY?.trim(),
    resend: !!process.env.RESEND_API_KEY?.trim(),
    fromEmail: process.env.MAIL_FROM_EMAIL ?? "(default info@gnsassociates.co.uk)",
    providerOrder: process.env.MAIL_PROVIDER_ORDER ?? "(default smtp2go,smtp,brevo,resend)",
  };

  if (req.nextUrl.searchParams.get("send") !== "1") {
    return NextResponse.json({ configured: cfg });
  }

  const to = req.nextUrl.searchParams.get("to") || "info@gnsassociates.co.uk";
  // `&via=graph` forces a Graph-only send for testing, ignoring the configured
  // provider order (which is still "smtp" until the operator updates it).
  const via = req.nextUrl.searchParams.get("via");
  const savedOrder = process.env.MAIL_PROVIDER_ORDER;
  if (via) process.env.MAIL_PROVIDER_ORDER = via;
  const result = await sendMailResult({
    to,
    subject: "GNS Platform — mail delivery test (Microsoft Graph)",
    html: `<p>This is a mail delivery test from the GNS platform, sent ${new Date().toISOString()}.</p>
           <p>If you are reading this in your <b>inbox</b> from <b>info@gnsassociates.co.uk</b>, Microsoft Graph delivery works.</p>`,
    noGlobalCc: true,
  });
  if (via) process.env.MAIL_PROVIDER_ORDER = savedOrder;

  return NextResponse.json({ configured: cfg, testSend: result });
}
