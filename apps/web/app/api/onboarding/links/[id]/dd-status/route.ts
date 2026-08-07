/**
 * Direct Debit confirmation status, polled by the engage page while a client
 * sits on the "waiting for your bank to confirm" screen. Deliberately returns
 * the bare minimum (no bank details, no contract data) since it is unauthenticated
 * beyond possession of the onboarding token.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";

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

    return NextResponse.json({
      status: link.status,
      confirmed: link.status === "accepted",
      pending: link.status === "pending_dd",
      mandateStatus: (gc.mandateStatus as string) ?? null,
      failureReason: (gc.mandateFailureReason as string) ?? null,
      signedLetterUrl: link.status === "accepted" && link.signedHtml
        ? `/api/onboarding/links/${params.id}/letter?signed=1`
        : null,
      uploadUrl: `/onboarding/documents/${params.id}`,
    });
  } catch (e) {
    console.error("dd-status failed:", e);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
