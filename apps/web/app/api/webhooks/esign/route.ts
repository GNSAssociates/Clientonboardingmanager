import { NextRequest, NextResponse } from "next/server";
import { handleEsignWebhook } from "@gns/core";
import { reportError } from "@/lib/observability";

/**
 * POST /api/webhooks/esign — inbound e-sign provider webhook.
 * Dropbox Sign sends event callbacks here. In production, verify the
 * HMAC-SHA256 signature from the X-Hellosign-Signature header before processing.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      event?: { event_type?: string; event_time?: string };
      signature_request?: {
        signature_request_id?: string;
        signatures?: Array<{ signer_email_address?: string }>;
      };
    };

    const providerRef = body.signature_request?.signature_request_id;
    const eventType = body.event?.event_type;
    const signerEmail = body.signature_request?.signatures?.[0]?.signer_email_address;

    if (!providerRef || !eventType) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    await handleEsignWebhook({
      providerRef,
      eventType,
      signerEmail,
      rawPayload: body as Record<string, unknown>,
    });

    // Dropbox Sign expects a 200 with "Hello API Event Received"
    return new NextResponse("Hello API Event Received", { status: 200 });
  } catch (err) {
    reportError(err, { context: "esign webhook" });
    return new NextResponse("Hello API Event Received", { status: 200 });
  }
}
