// Email sending via MailerLite Transactional API
// Docs: https://developers.mailerlite.com/docs/transactional
// Falls back to console.log when MAILERLITE_API_KEY is not set (dev mode).

export interface MailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  replyTo?: string;
}

interface MailerLiteResponse {
  id?: string;
  status?: string;
  errors?: Record<string, string[]>;
  message?: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const fromEmail = process.env.MAILERLITE_FROM_EMAIL ?? "info@gnsassociates.co.uk";
  const fromName = process.env.MAILERLITE_FROM_NAME ?? "GNS Associates";

  if (!apiKey) {
    // Dev fallback — log full details to the console
    console.log("\n" + "─".repeat(60));
    console.log(`📧 [EMAIL — dev mode, MAILERLITE_API_KEY not set]`);
    console.log(`   From   : ${fromName} <${fromEmail}>`);
    console.log(`   To     : ${opts.toName ? `${opts.toName} <${opts.to}>` : opts.to}`);
    console.log(`   Subject: ${opts.subject}`);
    if (opts.replyTo) console.log(`   ReplyTo: ${opts.replyTo}`);
    console.log("─".repeat(60) + "\n");
    return;
  }

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
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json() as MailerLiteResponse;
    const detail = err.message ?? JSON.stringify(err.errors ?? err);
    throw new Error(`MailerLite send failed (${res.status}): ${detail}`);
  }
}
