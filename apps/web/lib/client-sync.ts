/**
 * Push an onboarded client into the Invoice Summarizer app so the same client
 * exists in both systems (the two apps already share SSO — this adds a shared
 * client record). Server-to-server: authenticated by a shared secret header, no
 * user session. Entirely non-fatal — a sync failure never blocks onboarding.
 *
 * Config (env, on the onboarding app):
 *   INVOICE_APP_URL     base URL of the invoice app, e.g. https://invoice.practiceagents.co.uk
 *   CLIENT_SYNC_SECRET  shared secret (same value as the invoice app's CLIENT_SYNC_SECRET)
 */

export interface ClientSyncInput {
  name: string;
  companyNumber?: string | null;
  email?: string | null;
  directorName?: string | null;
  firmSlug?: string | null;
}

export function isClientSyncConfigured(): boolean {
  return Boolean(process.env.INVOICE_APP_URL && process.env.CLIENT_SYNC_SECRET);
}

export async function syncClientToInvoiceApp(input: ClientSyncInput): Promise<void> {
  const base = process.env.INVOICE_APP_URL?.trim();
  const secret = process.env.CLIENT_SYNC_SECRET?.trim();
  if (!base || !secret || !input.name?.trim()) return; // not configured / nothing to sync
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(base.replace(/\/+$/, "") + "/api/clients/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": secret },
      body: JSON.stringify({
        name: input.name.trim(),
        companyNumber: input.companyNumber || undefined,
        email: input.email || undefined,
        directorName: input.directorName || undefined,
        firmSlug: input.firmSlug || undefined,
        source: "onboarding",
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      console.warn(`Client sync to invoice app returned ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 300));
    }
  } catch (e) {
    console.warn("Client sync to invoice app failed (non-fatal):", e instanceof Error ? e.message : String(e));
  }
}
