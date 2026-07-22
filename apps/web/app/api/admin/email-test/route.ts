import { NextRequest, NextResponse } from "next/server";
import { sendMailResult } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Email diagnostics. GET reports which providers are configured; POST { to }
 * attempts a real send and returns the provider + any error, so email delivery
 * problems (e.g. Office 365 SMTP AUTH disabled) can be diagnosed precisely.
 * Guarded by a secret so it can be called during setup.
 */
function authed(req: NextRequest): boolean {
  const key = req.nextUrl.searchParams.get("key");
  const allowed = [process.env.CRON_SECRET, process.env.EMAIL_TEST_KEY].filter(Boolean);
  if (allowed.length === 0) return true; // nothing to check against — allow during setup
  return allowed.includes(key ?? "");
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    smtp: {
      configured: Boolean(process.env.SMTP_HOST),
      host: process.env.SMTP_HOST ?? null,
      port: process.env.SMTP_PORT ?? null,
      user: process.env.SMTP_USER ?? null,
      hasPassword: Boolean(process.env.SMTP_PASSWORD),
    },
    smtp2go: { configured: Boolean(process.env.SMTP2GO_API_KEY), from: process.env.SMTP2GO_FROM_EMAIL ?? process.env.MAIL_FROM_EMAIL ?? "info@gnsassociates.co.uk" },
    brevo: { configured: Boolean(process.env.BREVO_API_KEY), from: process.env.BREVO_FROM_EMAIL ?? process.env.MAIL_FROM_EMAIL ?? "info@gnsassociates.co.uk" },
    resend: { configured: Boolean(process.env.RESEND_API_KEY), from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev" },
    providerOrder: process.env.MAIL_PROVIDER_ORDER ?? "smtp2go,smtp,brevo,resend",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
  });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const to = (body?.to as string) || process.env.SMTP_USER || "info@gnsassociates.co.uk";

  const result = await sendMailResult({
    to,
    subject: "GNS Onboarding — email delivery test",
    html: `<p>This is a test email from the GNS Onboarding platform. If you received this, email delivery is working.</p><p>Sent: ${new Date().toISOString()}</p>`,
  });

  return NextResponse.json({ to, ...result });
}
