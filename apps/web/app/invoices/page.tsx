import { redirect } from "next/navigation";
import InvoicesClient from "./invoices-client";
import { requireSession } from "@/lib/auth/session";
import { resolveModuleAccess } from "@/lib/auth/module-access";

export const dynamic = "force-dynamic";

/**
 * Server wrapper: reads the Invoice Summarizer address from the RUNTIME
 * environment (INVOICE_SERVICE_URL, with the old NEXT_PUBLIC_ name as a
 * fallback) so operators can point the embed at the service by setting an
 * env var and restarting — no rebuild required.
 */
export default async function InvoicesPage() {
  // Gate: the Partner panel can disable the Invoice Summarizer per role
  // (with a safe fallback to role rules). No access → back to the dashboard.
  const session = requireSession();
  const access = await resolveModuleAccess(session);
  if (!access.invoice) redirect("/dashboard");

  const serviceUrl =
    process.env.INVOICE_SERVICE_URL ||
    process.env.NEXT_PUBLIC_INVOICE_SERVICE_URL ||
    "";
  return <InvoicesClient serviceUrl={serviceUrl} />;
}
