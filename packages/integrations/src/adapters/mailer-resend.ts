import type { MailerPort, OutboundEmail } from "@gns/core";

async function sendViaResend(message: OutboundEmail): Promise<{ providerRef: string }> {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("RESEND_API_KEY not set");

  const fromName = process.env["MAILERLITE_FROM_NAME"] ?? "GNS Associates";
  const body = {
    from: message.from ?? `${fromName} <onboarding@resend.dev>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
    ...(message.replyTo ? { reply_to: message.replyTo } : {}),
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Resend failed (${res.status}): ${err.message ?? "unknown"}`);
  }

  const data = await res.json() as { id?: string };
  return { providerRef: data.id ?? `resend-${Date.now()}` };
}

function sendStub(message: OutboundEmail): Promise<{ providerRef: string }> {
  const ref = `resend-stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[mailer-resend:stub] No RESEND_API_KEY — logging to console`);
  console.log(`  → To     : ${message.to}`);
  console.log(`  → Subject: ${message.subject}`);
  console.log(`  → Ref    : ${ref}`);
  return Promise.resolve({ providerRef: ref });
}

export const resendMailerAdapter: MailerPort = {
  provider: "resend",
  send(message: OutboundEmail): Promise<{ providerRef: string }> {
    const hasKey =
      typeof process.env["RESEND_API_KEY"] === "string" &&
      process.env["RESEND_API_KEY"].length > 0;
    return hasKey ? sendViaResend(message) : sendStub(message);
  },
};
