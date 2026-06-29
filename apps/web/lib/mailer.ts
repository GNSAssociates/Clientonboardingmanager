// Email sending — supports Resend (primary) and MailerLite Transactional (fallback)
// Resend: no domain verification needed for testing, free tier 100/day
// MailerLite: requires verified sender domain (use once gnsassociates.co.uk is verified)
// Falls back to console.log when neither key is set.

export interface MailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const mailerliteKey = process.env.MAILERLITE_API_KEY;
  const fromEmail = process.env.MAILERLITE_FROM_EMAIL ?? "info@gnsassociates.co.uk";
  const fromName = process.env.MAILERLITE_FROM_NAME ?? "GNS Associates";

  // ── 1. Resend (preferred — works without domain verification) ─────────────
  if (resendKey) {
    const body = {
      from: `${fromName} <onboarding@resend.dev>`,
      to: opts.toName ? `${opts.toName} <${opts.to}>` : opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as { message?: string; name?: string };
      throw new Error(`Resend failed (${res.status}): ${err.message ?? JSON.stringify(err)}`);
    }
    return;
  }

  // ── 2. MailerLite Transactional (requires verified sender domain) ─────────
  if (mailerliteKey) {
    const body = {
      from: { email: fromEmail, name: fromName },
      to: [{ email: opts.to, ...(opts.toName ? { name: opts.toName } : {}) }],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: { email: opts.replyTo } } : {}),
    };

    const res = await fetch("https://connect.mailerlite.com/api/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mailerliteKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as { message?: string; errors?: unknown };
      const detail = err.message ?? JSON.stringify(err.errors ?? err);
      throw new Error(`MailerLite send failed (${res.status}): ${detail}`);
    }
    return;
  }

  // ── 3. Dev fallback — log to console ─────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log(`📧 [EMAIL — no provider key set, logging to console]`);
  console.log(`   From   : ${fromName} <${fromEmail}>`);
  console.log(`   To     : ${opts.toName ? `${opts.toName} <${opts.to}>` : opts.to}`);
  console.log(`   Subject: ${opts.subject}`);
  if (opts.replyTo) console.log(`   ReplyTo: ${opts.replyTo}`);
  console.log("─".repeat(60) + "\n");
}
