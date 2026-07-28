import nodemailer from "nodemailer";

export interface MailAttachment {
  filename: string;
  content: Buffer | string; // raw bytes (Buffer) or a string
  contentType?: string;
}

export interface MailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string;       // per-call CC (added alongside the global CC)
  noGlobalCc?: boolean; // suppress the firm-wide CC (e.g. internal notifications)
  attachments?: MailAttachment[]; // e.g. the clearance .docx
}

export interface MailResult {
  ok: boolean;
  provider: "graph" | "smtp2go" | "smtp" | "brevo" | "resend" | "none";
  error?: string;
}

const fromName = process.env.MAIL_FROM_NAME ?? "GNS Associates";
const fromEmail = process.env.MAIL_FROM_EMAIL ?? "info@gnsassociates.co.uk";
// When sending via the host mailbox (noreply@practiceagents.co.uk), replies
// should still reach the practice inbox. Applied when a send sets no replyTo.
const defaultReplyTo = process.env.MAIL_REPLY_TO ?? "info@gnsassociates.co.uk";
// Blanket CC is DISABLED — the practice does not want every email copied to a
// shared inbox. CC is now applied per-event only (see send-templated-mail.ts),
// e.g. info@ on engagement-sent and previous-accountant clearance emails.
const globalCc: string = "";

// Build the CC list for a send: the global CC plus any per-call CC, de-duped,
// excluding the recipient to avoid an obvious double.
function ccFor(opts: MailOptions): string | undefined {
  if (opts.noGlobalCc && !opts.cc) return opts.cc;
  const set = new Set<string>();
  if (!opts.noGlobalCc && globalCc) set.add(globalCc.toLowerCase());
  if (opts.cc) opts.cc.split(",").forEach((c) => c.trim() && set.add(c.trim().toLowerCase()));
  set.delete(opts.to.trim().toLowerCase());
  return set.size ? [...set].join(", ") : undefined;
}

// Microsoft Graph sendMail (HTTPS). Sends AS the mailbox (info@gnsassociates.co.uk)
// through Microsoft's own servers, so it sidesteps the host's outbound-SMTP block
// AND is fully SPF/DKIM authenticated by the M365 tenant — mail lands in the inbox,
// not junk. Reuses the Entra app registration already set up for OneDrive; that
// registration needs the Application permission **Mail.Send** (admin-consented).
async function tryGraph(opts: MailOptions): Promise<void> {
  const { getGraphToken } = await import("@/lib/onedrive");
  const token = await getGraphToken();
  if (!token) throw new Error("Graph token unavailable (check ENTRA_* env)");

  const sender = (process.env.GRAPH_MAIL_SENDER || fromEmail).trim();
  const cc = ccFor(opts);
  const message: Record<string, unknown> = {
    subject: opts.subject,
    body: { contentType: "HTML", content: opts.html },
    toRecipients: [{ emailAddress: { address: opts.to, ...(opts.toName ? { name: opts.toName } : {}) } }],
    ...(cc ? { ccRecipients: cc.split(",").map((a) => ({ emailAddress: { address: a.trim() } })) } : {}),
    ...(opts.replyTo ? { replyTo: [{ emailAddress: { address: opts.replyTo } }] } : {}),
    ...(opts.attachments?.length
      ? {
          attachments: opts.attachments.map((a) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: a.filename,
            ...(a.contentType ? { contentType: a.contentType } : {}),
            contentBytes: Buffer.isBuffer(a.content)
              ? a.content.toString("base64")
              : Buffer.from(a.content).toString("base64"),
          })),
        }
      : {}),
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message, saveToSentItems: true }),
    },
  );
  // Graph returns 202 Accepted with an empty body on success.
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Graph ${res.status}: ${body.slice(0, 300) || "sendMail failed"}`);
  }
}

async function trySmtp(opts: MailOptions): Promise<void> {
  const host = process.env.SMTP_HOST!.trim();
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD; // do NOT trim — passwords may contain spaces

  const transporter = nodemailer.createTransport({
    host,
    port,
    // 465 = implicit TLS; 587/25 = STARTTLS (secure:false + requireTLS)
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: { minVersion: "TLSv1.2" },
  });

  // Display "From" uses info@ (or MAIL_FROM_EMAIL). The envelope sender only
  // needs an explicit override for Office 365 when the authenticated mailbox
  // differs from the From address — set MAIL_ENVELOPE_SENDER for that. Left
  // unset (the default), nodemailer uses From, which is what every third-party
  // relay (Brevo / SendGrid / Mailgun / etc.) expects.
  const displayFrom = fromEmail || user;
  const envelopeSender = process.env.MAIL_ENVELOPE_SENDER?.trim();
  const cc = ccFor(opts);
  await transporter.sendMail({
    from: `"${fromName}" <${displayFrom}>`,
    ...(envelopeSender ? { sender: envelopeSender } : {}),
    to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(cc ? { cc } : {}),
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...(opts.attachments?.length
      ? { attachments: opts.attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) }
      : {}),
  });
}

// SMTP2GO transactional email over HTTPS. Free tier is 1,000 emails/month.
// Uses the HTTP API (not SMTP), so it works even where outbound SMTP ports are
// blocked — e.g. many cPanel/shared hosts — making it the most portable choice
// across Vercel and cPanel. Configure with SMTP2GO_API_KEY (+ optional
// SMTP2GO_FROM_EMAIL). Sender must be a verified sender in SMTP2GO.
async function trySmtp2go(opts: MailOptions): Promise<void> {
  const apiKey = process.env.SMTP2GO_API_KEY!.trim();
  const senderEmail = (process.env.SMTP2GO_FROM_EMAIL || fromEmail).trim();
  const cc = ccFor(opts);
  const res = await fetch("https://api.smtp2go.com/v3/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      sender: `${fromName} <${senderEmail}>`,
      to: [opts.toName ? `${opts.toName} <${opts.to}>` : opts.to],
      subject: opts.subject,
      html_body: opts.html,
      ...(cc ? { cc: cc.split(",").map((s) => s.trim()) } : {}),
      ...(opts.replyTo ? { custom_headers: [{ header: "Reply-To", value: opts.replyTo }] } : {}),
    }),
  });
  const json = await res.json().catch(() => ({})) as { data?: { succeeded?: number; error?: string; failures?: unknown[] } };
  if (!res.ok || (json.data && (json.data.succeeded ?? 0) < 1)) {
    throw new Error(`SMTP2GO ${res.status}: ${json.data?.error ?? JSON.stringify(json.data?.failures ?? "send failed")}`);
  }
}

// Brevo (formerly Sendinblue) transactional email over HTTPS. Free tier is
// 300 emails/day. Works where outbound SMTP ports are blocked (some cPanel
// hosts), and only needs a single verified sender — no DNS setup required to
// start. Configure with BREVO_API_KEY (+ optional BREVO_FROM_EMAIL).
async function tryBrevo(opts: MailOptions): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY!.trim();
  const senderEmail = (process.env.BREVO_FROM_EMAIL || fromEmail).trim();
  const cc = ccFor(opts);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: fromName, email: senderEmail },
      to: [{ email: opts.to, ...(opts.toName ? { name: opts.toName } : {}) }],
      subject: opts.subject,
      htmlContent: opts.html,
      ...(cc ? { cc: cc.split(",").map((s) => ({ email: s.trim() })) } : {}),
      ...(opts.replyTo ? { replyTo: { email: opts.replyTo } } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; code?: string };
    throw new Error(`Brevo ${res.status}: ${err.message ?? err.code ?? "send failed"}`);
  }
}

async function tryResend(opts: MailOptions): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY!.trim();
  const resendFrom = process.env.RESEND_FROM_EMAIL
    ? `${fromName} <${process.env.RESEND_FROM_EMAIL}>`
    : `${fromName} <onboarding@resend.dev>`;

  const cc = ccFor(opts);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: resendFrom,
      to: opts.toName ? `${opts.toName} <${opts.to}>` : opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(cc ? { cc: cc.split(",").map((s) => s.trim()) } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Resend ${res.status}: ${err.message ?? "send failed"}`);
  }
}

/**
 * Send an email, trying each configured provider in turn (SMTP → Brevo →
 * Resend) until one succeeds. Returns a result rather than throwing so callers
 * never break a flow on a mail failure — the outcome is logged and surfaced
 * for diagnostics. Set MAIL_PROVIDER_ORDER (comma-separated) to change order.
 */
export async function sendMailResult(opts: MailOptions): Promise<MailResult> {
  // Every send replies to the practice inbox unless a caller overrides it.
  opts = { ...opts, replyTo: opts.replyTo ?? defaultReplyTo };
  const graphReady = !!(process.env.ENTRA_TENANT_ID?.trim() && process.env.ENTRA_CLIENT_ID?.trim() && process.env.ENTRA_CLIENT_SECRET?.trim());
  const smtp2goKey = process.env.SMTP2GO_API_KEY?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();

  const available: Record<string, { enabled: boolean; run: () => Promise<void> }> = {
    graph: { enabled: graphReady, run: () => tryGraph(opts) },
    smtp2go: { enabled: !!smtp2goKey, run: () => trySmtp2go(opts) },
    smtp: { enabled: !!smtpHost, run: () => trySmtp(opts) },
    brevo: { enabled: !!brevoKey, run: () => tryBrevo(opts) },
    resend: { enabled: !!resendKey, run: () => tryResend(opts) },
  };

  // Graph first (authenticated info@ sender, lands in inbox), SMTP as fallback.
  const order = (process.env.MAIL_PROVIDER_ORDER?.trim().split(",").map((s) => s.trim()).filter(Boolean))
    ?? ["graph", "smtp2go", "smtp", "brevo", "resend"];
  const chain = order.filter((p) => available[p]?.enabled) as Array<"graph" | "smtp2go" | "smtp" | "brevo" | "resend">;

  if (chain.length === 0) {
    console.log(`[EMAIL] No provider configured — would have sent "${opts.subject}" to ${opts.to}`);
    return { ok: false, provider: "none", error: "No email provider configured" };
  }

  const errors: string[] = [];
  const last = chain[chain.length - 1];
  for (const provider of chain) {
    try {
      await available[provider]!.run();
      return { ok: true, provider };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${provider}: ${msg}`);
      console.error(`${provider} send failed${provider !== last ? ", will try fallback" : ""}:`, msg);
    }
  }
  return { ok: false, provider: chain[0]!, error: errors.join(" | ") };
}

/** Back-compat wrapper — throws only if every configured provider failed. */
export async function sendMail(opts: MailOptions): Promise<void> {
  const r = await sendMailResult(opts);
  if (!r.ok && r.provider !== "none") {
    throw new Error(r.error ?? "Email send failed");
  }
}
