import nodemailer from "nodemailer";

export interface MailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  replyTo?: string;
}

const fromName = process.env.MAIL_FROM_NAME ?? "GNS Associates";
const fromEmail = process.env.MAIL_FROM_EMAIL ?? "info@gnsassociates.co.uk";

export async function sendMail(opts: MailOptions): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();

  // ── 1. SMTP (works immediately with any email provider) ───────────────────
  if (smtpHost) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER ?? fromEmail}>`,
      to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });
    return;
  }

  // ── 2. Resend API ─────────────────────────────────────────────────────────
  if (resendKey) {
    // Use verified custom domain if configured, else resend.dev test address
    const resendFrom = process.env.RESEND_FROM_EMAIL
      ? `${fromName} <${process.env.RESEND_FROM_EMAIL}>`
      : `${fromName} <onboarding@resend.dev>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: resendFrom,
        to: opts.toName ? `${opts.toName} <${opts.to}>` : opts.to,
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.json() as { message?: string; name?: string };
      throw new Error(`Resend error (${res.status}): ${err.message ?? JSON.stringify(err)}`);
    }
    return;
  }

  // ── 3. No provider configured — log to console ────────────────────────────
  console.log("─".repeat(60));
  console.log(`[EMAIL] No provider configured — logging only`);
  console.log(`  To     : ${opts.toName ? `${opts.toName} <${opts.to}>` : opts.to}`);
  console.log(`  Subject: ${opts.subject}`);
  console.log("─".repeat(60));
}
