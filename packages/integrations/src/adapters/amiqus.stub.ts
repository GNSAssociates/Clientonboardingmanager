import type { KycProvider } from "@gns/core";

/**
 * Amiqus KYC/AML adapter (M5).
 * Amiqus (https://amiqus.co) — UK accountancy-focused IDV + AML + sanctions + PEP.
 *
 * Real API endpoints (prod wiring — M13):
 *   POST /v2/clients           → create client record
 *   POST /v2/requests          → initiate check (ID, AML, sanctions)
 *   GET  /v2/requests/:id      → poll result
 *   Webhook: amiqus sends status updates to /api/webhooks/kyc
 *
 * Stub behaviour (no AMIQUS_API_KEY):
 *   initiate → returns fake ref
 *   getResult → returns "passed" after delay simulation
 */
export const amiqusStubAdapter: KycProvider = {
  provider: "amiqus",

  async initiate(input) {
    if (process.env["AMIQUS_API_KEY"]) {
      return initiateReal(input);
    }
    return { ref: `amiqus-stub-${Date.now()}` };
  },

  async getResult(ref) {
    if (process.env["AMIQUS_API_KEY"]) {
      return getResultReal(ref);
    }
    // Stub: always passes in dev
    return {
      status: "passed",
      result: {
        ref,
        idVerification: "passed",
        sanctionsPep: "clear",
        adverseMedia: "clear",
        completedAt: new Date().toISOString(),
      },
    };
  },
};

/* ── real API ─────────────────────────────────────────────────────────────── */
function amiqusHeaders() {
  return {
    Authorization: `Bearer ${process.env["AMIQUS_API_KEY"]}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function initiateReal(input: Parameters<KycProvider["initiate"]>[0]) {
  // 1. Create client in Amiqus
  const clientRes = await fetch("https://id.amiqus.co/api/v2/clients", {
    method: "POST",
    headers: amiqusHeaders(),
    body: JSON.stringify({
      email: input.email,
      full_name: input.name,
    }),
  });
  if (!clientRes.ok) {
    const txt = await clientRes.text();
    throw new Error(`Amiqus create client failed ${clientRes.status}: ${txt}`);
  }
  const client = (await clientRes.json()) as { id?: string };
  if (!client.id) throw new Error("Amiqus: no client id returned");

  // 2. Create a request (check bundle)
  const checks = input.checks.length ? input.checks : ["identity_document", "aml_sanctions_pep"];
  const requestRes = await fetch("https://id.amiqus.co/api/v2/requests", {
    method: "POST",
    headers: amiqusHeaders(),
    body: JSON.stringify({
      client_id: client.id,
      steps: checks.map((c) => ({ type: c })),
      notify: true,
    }),
  });
  if (!requestRes.ok) {
    const txt = await requestRes.text();
    throw new Error(`Amiqus create request failed ${requestRes.status}: ${txt}`);
  }
  const request = (await requestRes.json()) as { id?: string };
  if (!request.id) throw new Error("Amiqus: no request id returned");

  return { ref: request.id };
}

async function getResultReal(ref: string) {
  const res = await fetch(`https://id.amiqus.co/api/v2/requests/${encodeURIComponent(ref)}`, {
    headers: amiqusHeaders(),
  });
  if (!res.ok) throw new Error(`Amiqus getResult failed ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  const status = String(data["status"] ?? "pending");
  return {
    status: mapAmiqusStatus(status),
    result: data as Record<string, unknown>,
  };
}

function mapAmiqusStatus(s: string): string {
  const m: Record<string, string> = {
    complete: "passed",
    pending: "in_progress",
    processing: "in_progress",
    failed: "failed",
    declined: "failed",
  };
  return m[s] ?? "in_progress";
}
