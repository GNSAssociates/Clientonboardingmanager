import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { lookupBankDetails } from "@/lib/gocardless";

export const dynamic = "force-dynamic";

/**
 * GoCardless-style live bank lookup: given a sort code + account number, resolve
 * the bank name (and BACS support) via GoCardless, so the signing page can show
 * the bank exactly as the GoCardless hosted screen does. One outbound HTTP call
 * only — NPROC-safe; the client debounces it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { accountNumber, sortCode } = (await req.json()) as {
      accountNumber?: string;
      sortCode?: string;
    };
    if (!accountNumber || !sortCode) {
      return NextResponse.json({ ok: false, error: "incomplete" }, { status: 200 });
    }

    const db = getDb();
    const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
    if (!link) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const result = await lookupBankDetails(link.firmSlug || "gns", accountNumber, sortCode);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Bank lookup error:", err);
    return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 200 });
  }
}
