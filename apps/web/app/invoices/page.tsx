import { redirect } from "next/navigation";
import InvoicesClient from "./invoices-client";
import { requireSession } from "@/lib/auth/session";
import { resolveModuleAccess } from "@/lib/auth/module-access";
import { makeSsoToken } from "@/lib/auth/sso-token";
import { getUserEmailById } from "@gns/db";

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

  // Single sign-on: mint a short-lived signed token so the embedded Invoice
  // Summarizer logs the user in automatically (no second login). If SSO isn't
  // configured (no shared secret), we embed the plain URL and the invoice app's
  // own login is shown — a safe fallback that never breaks the page.
  let embedUrl = serviceUrl;
  if (serviceUrl && process.env.SSO_SHARED_SECRET) {
    try {
      const email = await getUserEmailById(session.userId);
      if (email) {
        const role =
          session.isAdmin || session.roles.some((r) => r === "Admin" || r === "Partner")
            ? "admin"
            : "staff";
        const token = makeSsoToken({ email, name: session.displayName, role });
        if (token) {
          embedUrl = `${serviceUrl.replace(/\/$/, "")}/api/auth/sso?token=${encodeURIComponent(token)}`;
        }
      }
    } catch (e) {
      console.error("SSO token build failed; embedding plain invoice URL:", e);
    }
  }

  return <InvoicesClient serviceUrl={serviceUrl} embedUrl={embedUrl} />;
}
