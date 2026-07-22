import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Staff-only: full client record export (JSON) — bank details masked.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const dd = acc.directDebit as { accountName?: string; accountNumber?: string; sortCode?: string; bankAddress?: string } | null;

  const details = {
    company: {
      name: link.companyName,
      number: link.companyNumber,
    },
    director: {
      name: link.directorName,
      email: link.clientEmail,
    },
    firm: link.firmSlug,
    engagement: {
      status: link.status,
      sentAt: link.sentAt,
      acceptedAt: link.acceptedAt,
      expiresAt: link.expiresAt,
      services: link.services,
      signatureName: acc.signatureName ?? null,
      signedAt: acc.signedAt ?? null,
      contactPreferences: acc.contactPrefs ?? [],
    },
    previousAccountant: {
      firmName: link.prevAccountantFirmName,
      email: link.prevAccountantEmail,
      phone: acc.prevPhone ?? null,
    },
    // Full mandate details — staff-only endpoint; needed to re-key or retry
    // the Direct Debit if the client's input failed GoCardless validation
    directDebit: dd ? {
      accountName: dd.accountName ?? null,
      accountNumber: dd.accountNumber ?? null,
      sortCode: dd.sortCode ?? null,
      bankAddress: dd.bankAddress ?? null,
      gocardless: acc.gocardless ?? null,
    } : null,
    documents: {
      director: acc.directorDocs ?? [],
      company: acc.companyDocs ?? [],
    },
    stopClientChase: acc.stopClientChase === true,
    audit: acc.audit ?? null,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (req.nextUrl.searchParams.get("download") === "1") {
    const name = `Client Details - ${(link.companyName ?? "client").replace(/[\\/:*?"<>|]/g, "-")}.json`;
    headers["Content-Disposition"] = `attachment; filename="${name}"`;
  }
  return new NextResponse(JSON.stringify(details, null, 2), { headers });
}
