import type { ESignProvider } from "@gns/core";

/**
 * Dropbox Sign e-signature adapter — stub for dev (M4).
 * In production, swap for the real Dropbox Sign (HelloSign) API adapter
 * by calling `https://api.hellosign.com/v3/signature_request/send`.
 *
 * Stub behaviour:
 *   createEnvelope  → returns a fake envelopeId
 *   void            → no-op
 *
 * Real adapter registration (M4 production wiring):
 *   - Set DROPBOX_SIGN_API_KEY in env
 *   - POST document to /v3/signature_request/send_with_document
 *   - Return signatureRequestId as envelopeId
 *   - Webhook URL: /api/webhooks/esign
 */
export const dropboxSignStubAdapter: ESignProvider = {
  provider: "dropbox_sign",

  async createEnvelope(input) {
    if (process.env["DROPBOX_SIGN_API_KEY"]) {
      return createRealEnvelope(input);
    }
    const envelopeId = `stub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return { envelopeId };
  },

  async void(_envelopeId) {
    // no-op in stub; real adapter calls DELETE /v3/signature_request/cancel/:id
  },
};

async function createRealEnvelope(input: Parameters<ESignProvider["createEnvelope"]>[0]) {
  const apiKey = process.env["DROPBOX_SIGN_API_KEY"]!;

  const body = {
    test_mode: process.env["NODE_ENV"] !== "production" ? 1 : 0,
    subject: "Please sign: Engagement / Authority letter",
    message: "Please review and sign the attached document.",
    signers: input.signers.map((s, i) => ({
      email_address: s.email,
      name: s.name,
      order: i,
    })),
    file_url: [input.documentUrl],
    signing_options: {
      draw: true,
      type: true,
      upload: false,
      phone: false,
      default_type: "type",
    },
  };

  const res = await fetch("https://api.hellosign.com/v3/signature_request/send_with_url", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox Sign API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { signature_request?: { signature_request_id: string } };
  const envelopeId = data.signature_request?.signature_request_id;
  if (!envelopeId) throw new Error("Dropbox Sign did not return a signature_request_id");

  return { envelopeId };
}
