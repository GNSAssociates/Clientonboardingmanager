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
import { verifyDirectDebit } from "@/lib/gocardless";

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

    /* ALWAYS ask GoCardless — never short-circuit on the stored flag.
       ddConfirmed used to be checked only when it was false, so once a client
       was confirmed we never looked again. Cancel their mandate in GoCardless
       and this endpoint happily kept reporting "set up", because a billing
       request stays `fulfilled` for ever regardless of what later happens to
       the mandate it produced. The flag is a cache of a fact that can change,
       so it is re-derived here and corrected in both directions.

       Only a mandate GoCardless positively reports as dead clears it: if the
       API cannot be reached we keep what we had, so an outage cannot revoke a
       client mid-signature. */
    let ddConfirmed = Boolean(gc.ddConfirmed);
    let brStatus: string | null = null;
    let mandateStatus: string | null = (gc.mandateStatus as string) ?? null;
    const billingRequestId = gc.billingRequestId as string | undefined;
    const knownMandateId = gc.mandateId as string | undefined;

    if (billingRequestId || knownMandateId) {
      const v = await verifyDirectDebit(link.firmSlug || "gns", {
        billingRequestId,
        mandateId: knownMandateId,
      });
      if (v.reachable) {
        brStatus = v.brStatus ?? null;
        mandateStatus = v.mandateStatus ?? mandateStatus;
        const next = v.ok;
        if (next !== ddConfirmed) {
          ddConfirmed = next;
          await db.transaction((tx) =>
            updateOnboardingLink(tx, link.id, {
              acceptanceData: {
                ...acc,
                gocardless: {
                  ...gc,
                  ddConfirmed: next,
                  ...(v.mandateId ? { mandateId: v.mandateId } : {}),
                  ...(v.mandateStatus ? { mandateStatus: v.mandateStatus } : {}),
                },
              },
            }),
          );
        }
      }
    }

    return NextResponse.json({
      status: link.status,
      // DD authorised via the hosted flow (the sign-gate condition).
      ddConfirmed,
      // Reported so a stuck mandate can be diagnosed without reading the logs.
      billingRequestStatus: brStatus,
      confirmed: link.status === "accepted",
      pending: link.status === "pending_dd",
      mandateStatus,
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
