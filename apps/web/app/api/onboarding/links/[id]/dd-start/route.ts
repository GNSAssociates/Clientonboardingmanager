/**
 * Start the Direct Debit setup via GoCardless Billing Requests. Creates a
 * billing request + hosted flow, stores the billing request id on the link, and
 * returns the GoCardless authorisation URL for the client to be redirected to.
 * Unauthenticated beyond possession of the onboarding token (like dd-status).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { createDirectDebitBillingRequest } from "@/lib/gocardless";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = params.id;
  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* `embedded` asks for a flow to be driven by the GoCardless drop-in, which
   * opens over the engagement letter instead of navigating away from it. The
   * client asked for exactly that: sending someone off to another website in
   * the middle of signing a contract is where they start wondering whether
   * they have been phished. The drop-in needs the flow ID, not a URL. */
  const body = await req.json().catch(() => ({}));
  const embedded = Boolean((body as { embedded?: boolean }).embedded);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://practiceagents.co.uk";
  const engageUrl = `${appUrl.replace(/\/+$/, "")}/onboarding/engage/${token}`;

  const br = await createDirectDebitBillingRequest({
    firmSlug: link.firmSlug || "gns",
    companyName: link.companyName ?? "",
    directorName: link.directorName ?? "",
    email: link.clientEmail,
    token,
    redirectUri: `${engageUrl}?dd=return`,
    exitUri: `${engageUrl}?dd=exit`,
    embedded,
  });

  if (!br.configured) {
    return NextResponse.json(
      { error: "gocardless_not_configured", message: "Direct Debit is not set up for this firm." },
      { status: 503 },
    );
  }
  if (embedded && br.success && br.billingRequestFlowId) {
    const acc0 = (link.acceptanceData ?? {}) as Record<string, unknown>;
    const gc0 = (acc0.gocardless ?? {}) as Record<string, unknown>;
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        acceptanceData: { ...acc0, gocardless: { ...gc0, billingRequestId: br.billingRequestId, ddConfirmed: false } },
      }),
    );
    return NextResponse.json({
      billingRequestFlowId: br.billingRequestFlowId,
      environment: process.env.GOCARDLESS_ENVIRONMENT === "sandbox" ? "sandbox" : "live",
      // Still returned so the page can fall back to the redirect if the
      // drop-in script is blocked by the client's browser.
      authorisationUrl: br.authorisationUrl ?? null,
    });
  }

  if (!br.success || !br.authorisationUrl) {
    return NextResponse.json(
      { error: "dd_start_failed", message: br.error || "Could not start Direct Debit setup." },
      { status: 502 },
    );
  }

  // Remember the billing request id so the return (dd-status) can verify it.
  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const gc = (acc.gocardless ?? {}) as Record<string, unknown>;
  await db.transaction((tx) =>
    updateOnboardingLink(tx, link.id, {
      acceptanceData: { ...acc, gocardless: { ...gc, billingRequestId: br.billingRequestId, ddConfirmed: false } },
    }),
  );

  return NextResponse.json({ authorisationUrl: br.authorisationUrl });
}
