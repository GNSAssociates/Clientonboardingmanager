/**
 * Direct Debit confirmation status, polled by the engage page.
 *
 * Two roles:
 *  1. Billing Requests gate (BEFORE signing): if the client has been through the
 *     GoCardless hosted flow, we check the billing request — when it is
 *     `fulfilled` a mandate was created, so we record the mandate id + mark the
 *     DD confirmed. The engage page only unlocks "Sign & Accept" once ddConfirmed.
 *  2. Legacy post-sign gate: still reports link.status (pending_dd → accepted).
 *
 * Returns the bare minimum (no bank details) since it is unauthenticated beyond
 * possession of the onboarding token.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getBillingRequestStatus } from "@/lib/gocardless";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
    const gc = (acc.gocardless ?? {}) as Record<string, unknown>;

    // Billing Requests gate: verify with GoCardless and cache the result.
    let ddConfirmed = Boolean(gc.ddConfirmed);
    const billingRequestId = gc.billingRequestId as string | undefined;
    if (!ddConfirmed && billingRequestId) {
      const st = await getBillingRequestStatus(link.firmSlug || "gns", billingRequestId);
      if (st.fulfilled) {
        ddConfirmed = true;
        await db.transaction((tx) =>
          updateOnboardingLink(tx, link.id, {
            acceptanceData: {
              ...acc,
              gocardless: { ...gc, ddConfirmed: true, mandateId: st.mandateId ?? (gc.mandateId as string | undefined) },
            },
          }),
        );
      }
    }

    return NextResponse.json({
      status: link.status,
      // DD authorised via the hosted flow (the sign-gate condition).
      ddConfirmed,
      confirmed: link.status === "accepted",
      pending: link.status === "pending_dd",
      mandateStatus: (gc.mandateStatus as string) ?? null,
      failureReason: (gc.mandateFailureReason as string) ?? null,
      signedLetterUrl: link.status === "accepted" && link.signedHtml
        ? `/api/onboarding/links/${params.id}/letter?signed=1&pdf=1`
        : null,
      uploadUrl: `/onboarding/documents/${params.id}`,
    });
  } catch (e) {
    console.error("dd-status failed:", e);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
