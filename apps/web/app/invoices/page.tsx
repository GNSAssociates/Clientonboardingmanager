import InvoicesClient from "./invoices-client";

export const dynamic = "force-dynamic";

/**
 * Server wrapper: reads the Invoice Summarizer address from the RUNTIME
 * environment (INVOICE_SERVICE_URL, with the old NEXT_PUBLIC_ name as a
 * fallback) so operators can point the embed at the service by setting an
 * env var and restarting — no rebuild required.
 */
export default function InvoicesPage() {
  const serviceUrl =
    process.env.INVOICE_SERVICE_URL ||
    process.env.NEXT_PUBLIC_INVOICE_SERVICE_URL ||
    "";
  return <InvoicesClient serviceUrl={serviceUrl} />;
}
