import { NextRequest, NextResponse } from "next/server";
import { getDb, listAllLinks, updateOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { setupDirectDebitMandate } from "@/lib/gocardless";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Set up GoCardless Direct Debit mandates for every signed client who provided
 * bank details but doesn't yet have a live mandate. Run this once after adding
 * the GoCardless access token — new signings create their mandate automatically,
 * this back-fills the ones signed while the token was missing.
 */
export async function POST() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const links = await db.transaction((tx) => listAllLinks(tx));

  let created = 0, skipped = 0, failed = 0;
  const results: Array<{ company: string | null; status: string; detail?: string }> = [];

  for (const link of links) {
    if (link.status !== "accepted") continue;
    const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
    const dd = acc.directDebit as { accountName?: string; accountNumber?: string; sortCode?: string; bankAddress?: string } | null;
    const gc = acc.gocardless as { success?: boolean } | null;

    if (!dd?.accountName) { continue; } // no bank details captured
    if (gc?.success) { skipped++; continue; } // already has a mandate

    const result = await setupDirectDebitMandate({
      firmSlug: link.firmSlug || "gns",
      companyName: link.companyName ?? "",
      directorName: (acc.signatureName as string) || link.directorName || "",
      email: link.clientEmail,
      dd: {
        accountName: dd.accountName,
        accountNumber: (dd.accountNumber ?? "").replace(/\D/g, ""),
        sortCode: (dd.sortCode ?? "").replace(/\D/g, ""),
        bankAddress: dd.bankAddress,
      },
      token: `${link.token}-batch`,
    });

    if (!result.configured) {
      return NextResponse.json({ error: "GoCardless not configured — add GOCARDLESS_ACCESS_TOKEN first", created, skipped, failed }, { status: 503 });
    }

    try {
      await db.transaction((tx) => updateOnboardingLink(tx, link.id, { acceptanceData: { ...acc, gocardless: result } }));
    } catch { /* non-fatal */ }

    if (result.success) { created++; results.push({ company: link.companyName, status: "created", detail: result.mandateId }); }
    else { failed++; results.push({ company: link.companyName, status: "failed", detail: result.error }); }
  }

  return NextResponse.json({ success: true, created, skipped, failed, results });
}
