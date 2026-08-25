import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, getDocumentSubmissions } from "@gns/db";
import { DOCUMENT_TYPES, REQUIRED_DOC_IDS } from "@/lib/document-types";
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

  // Real upload state from the document portal — not the client's INTENTION at
  // signing ("I'll send it later"), which is all acceptanceData holds. Staff need
  // to see what has actually arrived and what is genuinely outstanding.
  const submissions = await db
    .transaction((tx) => getDocumentSubmissions(tx, params.id))
    .catch(() => [] as Array<{ docType: string; status: string; fileName: string | null; uploadedAt: Date | null }>);

  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const lm = (link.letterMeta ?? {}) as Record<string, unknown>;
  const dd = acc.directDebit as { accountName?: string; accountNumber?: string; sortCode?: string; bankAddress?: string } | null;
  // What was actually sent to the client — drives the granular status view so a
  // "details only" authority signature isn't shown as a signed engagement.
  const sendMode = (lm.sendMode as string) ?? "engagement";
  const paymentMethod = (lm.paymentMethod as string) ?? "dd";

  const details = {
    company: {
      name: link.companyName,
      number: link.companyNumber,
      // Needed so a repeat engagement can be pre-filled rather than re-keyed.
      address: (lm.clientAddress as string) ?? null,
      clientType: (lm.clientType as string) ?? null,
    },
    director: {
      name: link.directorName,
      email: link.clientEmail,
    },
    firm: link.firmSlug,
    sendMode,
    paymentMethod,
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
      address: (acc.prevFirmAddress as string) ?? null,
      // The client can declare they have none — that is "complete", not "missing".
      noPreviousAccountant: acc.noPrevAccountant === true,
      missing: acc.noPrevAccountant === true
        ? []
        : ([
            ["Firm name", link.prevAccountantFirmName],
            ["Email", link.prevAccountantEmail],
            ["Phone", acc.prevPhone],
            ["Address", acc.prevFirmAddress],
          ] as Array<[string, unknown]>)
            .filter(([, v]) => !v || String(v).trim() === "")
            .map(([label]) => label),
    },
    // Direct Debit is set up on GoCardless's hosted page, so we never receive or
    // store bank details. Only the mandate outcome is reportable. `directDebit`
    // stays for older records captured before that change.
    directDebit: dd ? {
      accountName: dd.accountName ?? null,
      accountNumber: dd.accountNumber ?? null,
      sortCode: dd.sortCode ?? null,
      bankAddress: dd.bankAddress ?? null,
      gocardless: acc.gocardless ?? null,
    } : null,
    gocardless: acc.gocardless ?? null,
    documents: {
      director: acc.directorDocs ?? [],
      company: acc.companyDocs ?? [],
    },
    // What was asked for vs what has actually arrived.
    uploadedDocs: {
      required: REQUIRED_DOC_IDS.length,
      receivedRequired: REQUIRED_DOC_IDS.filter((id) =>
        submissions.some((r) => r.docType === id && r.status === "uploaded"),
      ).length,
      items: DOCUMENT_TYPES.map((dt) => {
        const row = submissions.find((r) => r.docType === dt.id);
        return {
          id: dt.id,
          label: dt.label,
          required: dt.required,
          received: row?.status === "uploaded",
          fileName: row?.fileName ?? null,
          uploadedAt: row?.uploadedAt ?? null,
        };
      }),
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
