import type { MailerPort, OutboundEmail } from "@gns/core";

const GRAPH_ENDPOINT = "https://graph.microsoft.com/v1.0";

async function sendViaGraph(message: OutboundEmail): Promise<{ providerRef: string }> {
  const token = process.env["GRAPH_MAILER_TOKEN"];
  const fromAddress = process.env["GRAPH_MAILER_FROM"] ?? message.from;
  if (!fromAddress) throw new Error("GRAPH_MAILER_FROM env var required");

  const body = {
    message: {
      subject: message.subject,
      body: { contentType: "HTML", content: message.html },
      toRecipients: [{ emailAddress: { address: message.to } }],
      ...(message.replyTo
        ? { replyTo: [{ emailAddress: { address: message.replyTo } }] }
        : {}),
    },
    saveToSentItems: true,
  };

  const res = await fetch(`${GRAPH_ENDPOINT}/users/${fromAddress}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph sendMail failed: ${res.status} ${text}`);
  }

  return { providerRef: `graph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
}

function sendStub(message: OutboundEmail): Promise<{ providerRef: string }> {
  const ref = `graph-stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[mailer-graph:stub] → ${message.to} | ${message.subject} | ref=${ref}`);
  return Promise.resolve({ providerRef: ref });
}

export const graphMailerAdapter: MailerPort = {
  provider: "graph",
  send(message: OutboundEmail): Promise<{ providerRef: string }> {
    const hasToken =
      typeof process.env["GRAPH_MAILER_TOKEN"] === "string" &&
      process.env["GRAPH_MAILER_TOKEN"].length > 0;
    return hasToken ? sendViaGraph(message) : sendStub(message);
  },
};
