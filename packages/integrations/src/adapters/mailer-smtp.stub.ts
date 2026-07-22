import type { MailerPort, OutboundEmail } from "@gns/core";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) return null;
  return {
    host,
    port: Number(process.env["SMTP_PORT"] ?? "587"),
    secure: process.env["SMTP_SECURE"] === "true",
    user,
    pass,
    from: process.env["SMTP_FROM"] ?? user,
  };
}

async function sendViaSmtp(
  config: SmtpConfig,
  message: OutboundEmail,
): Promise<{ providerRef: string }> {
  // Runtime import — nodemailer is optional; only needed when SMTP_HOST is set.
  // Use Function constructor to prevent TypeScript's static module resolution.
  const load = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
  const nm = (await load("nodemailer")) as {
    createTransport: (opts: object) => {
      sendMail: (mail: object) => Promise<{ messageId?: string }>;
    };
  };
  const transporter = nm.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });

  const info = await transporter.sendMail({
    from: message.from ?? config.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    replyTo: message.replyTo,
  });

  return { providerRef: info.messageId ?? `smtp-${Date.now()}` };
}

function sendStub(message: OutboundEmail): Promise<{ providerRef: string }> {
  const ref = `smtp-stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[mailer-smtp:stub] → ${message.to} | ${message.subject} | ref=${ref}`);
  return Promise.resolve({ providerRef: ref });
}

export const smtpMailerAdapter: MailerPort = {
  provider: "smtp",
  send(message: OutboundEmail): Promise<{ providerRef: string }> {
    const config = getSmtpConfig();
    return config ? sendViaSmtp(config, message) : sendStub(message);
  },
};
