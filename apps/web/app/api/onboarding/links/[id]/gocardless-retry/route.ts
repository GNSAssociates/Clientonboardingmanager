import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { setupDirectDebitMandate } from "@/lib/gocardless";

export const dynamic = "force-dynamic";

// Staff-only: retry the GoCardless mandate setup for a signed client, using
// either the stored bank details or corrected details supplied in the body.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const stored = acc.directDebit as { accountName?: string; accountNumber?: string; sortCode?: string; bankAddress?: string } | null;

  const body = await req.json().catch(() => ({})) as {
    accountName?: string; accountNumber?: string; sortCode?: string; bankAddress?: string;
  };

  const dd = {
    accountName: body.accountName ?? stored?.accountName ?? "",
    accountNumber: (body.accountNumber ?? stored?.accountNumber ?? "").replace(/\D/g, ""),
    sortCode: (body.sortCode ?? stored?.sortCode ?? "").replace(/\D/g, ""),
    bankAddress: body.bankAddress ?? stored?.bankAddress ?? "",
  };

  if (!dd.accountName || dd.accountNumber.length < 6 || dd.sortCode.length !== 6) {
    return NextResponse.json({ error: "Valid account name, account number (6–8 digits) and 6-digit sort code required" }, { status: 400 });
  }

  const result = await setupDirectDebitMandate({
    firmSlug: link.firmSlug || "gns",
    companyName: link.companyName ?? "",
    directorName: (acc.signatureName as string) || link.directorName || "",
    email: link.clientEmail,
    dd,
    token: `${params.id}-r${Date.now()}`, // fresh idempotency key for the retry
  });

  // Store the corrected details + latest GoCardless outcome (non-fatal)
  try {
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        acceptanceData: { ...acc, directDebit: dd, gocardless: result },
      })
    );
  } catch (e) {
    console.error("Failed to persist GC retry result:", e);
  }

  if (!result.configured) {
    return NextResponse.json({ error: "GoCardless is not configured yet — add GOCARDLESS_ACCESS_TOKEN in Vercel" }, { status: 503 });
  }
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "GoCardless setup failed" }, { status: 502 });
  }
  return NextResponse.json({ success: true, mandateId: result.mandateId, customerId: result.customerId });
}
