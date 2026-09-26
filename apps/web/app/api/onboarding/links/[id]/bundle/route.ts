import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { resolve648 } from "@/lib/form-648-shared";
import type { LetterService, CustomFee, ScopeRow, ChDetails } from "@/lib/letter-html";

export const dynamic = "force-dynamic";

/**
 * Every signed document for one engagement, as a single PDF.
 *
 * The client signs once and that signature lands on several documents — the
 * engagement letter, the HMRC 64-8, the authority letter that goes to their
 * previous accountant. Handing those over as separate downloads, some of them
 * only ever sent to a third party, means the client never sees the full set
 * that we hold. This returns exactly what is on our file, in one file.
 *
 * Refuses until the engagement is signed: there is no such thing as a bundle of
 * signed documents before there is a signature.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const meta = (link.letterMeta ?? {}) as Record<string, unknown>;
  const signedAt = acc.signedAt as string | undefined;
  if (!signedAt || !link.signedHtml) {
    return NextResponse.json({ error: "This engagement has not been signed yet." }, { status: 409 });
  }

  const firm = getFirm(link.firmSlug || "gns");
  const bundle = await PDFDocument.create();
  /* What actually went in, reported back to the caller. A bundle that silently
     lost a document would be indistinguishable from one that never had it. */
  const included: string[] = [];

  const add = async (bytes: Buffer, label: string) => {
    const src = await PDFDocument.load(bytes);
    const pages = await bundle.copyPages(src, src.getPageIndices());
    pages.forEach((p) => bundle.addPage(p));
    included.push(label);
  };

  // 1) The signed engagement letter. This already carries the 64-8 and the
  //    certificate of completion, so they are not added again here.
  const { buildEngagementPdf } = await import("@/lib/engagement-pdf");
  const audit = (acc.audit ?? {}) as Record<string, unknown>;
  const r648 = resolve648({ letterMeta: meta, acceptanceData: acc, signed: true });
  const engagement = await buildEngagementPdf({
    firm,
    regBody: (meta.regBody as string) ?? firm.regBody,
    companyName: link.companyName ?? "",
    companyNumber: link.companyNumber ?? undefined,
    clientAddress: meta.clientAddress as string | undefined,
    directorName: link.directorName ?? undefined,
    partnerName: meta.partnerName as string | undefined,
    services: (link.services ?? []) as LetterService[],
    customFees: (meta.customFees as CustomFee[]) ?? [],
    scopeRows: (meta.scopeRows as ScopeRow[]) ?? undefined,
    ch: (meta.ch as ChDetails) ?? null,
    paymentMethod: meta.paymentMethod as string | undefined,
    includeAnnexA: meta.includeAnnexA as boolean | undefined,
    clientType: meta.clientType as string | undefined,
    clientName: meta.clientName as string | undefined,
    utr: meta.utr as string | undefined,
    form648: r648.included ? { taxes: r648.taxes } : null,
    dateStr: new Date(link.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    signedName: (acc.signatureName as string) ?? link.directorName ?? "",
    signedImage: (acc.signatureImage as string) ?? null,
    signedAt,
    signedIp: audit.ipAddress as string | undefined,
  });
  await add(engagement, r648.included ? "Signed engagement letter (including HMRC form 64-8)" : "Signed engagement letter");

  /* 2) The authority letter sent to the previous accountant.
        The client authorised this by signing, but it is addressed to a third
        party and they would otherwise never see the document that went out in
        their name. Only included when one was actually raised — and never when
        the client said they had no previous accountant. */
  const prevFirmName = link.prevAccountantFirmName?.trim();
  if (prevFirmName && acc.noPrevAccountant !== true && meta.includeClearance !== false) {
    try {
      const { buildAuthorityLetterPdf } = await import("@/lib/authority-letter-pdf");
      const authority = await buildAuthorityLetterPdf({
        firm,
        clientName: link.companyName ?? "",
        companyNumber: link.companyNumber ?? undefined,
        clientAddress: meta.clientAddress as string | undefined,
        directorName: link.directorName ?? undefined,
        prevFirmName,
        prevFirmAddress: (acc.prevFirmAddress as string) ?? undefined,
        today: new Date(signedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      });
      await add(authority, "Client authority letter to the previous accountant");
    } catch (e) {
      /* One document failing must not deny the client the rest of their file.
         Reported in the header so the omission is visible, not silent. */
      console.error("bundle: authority letter failed", e);
    }
  }

  const safe = (link.companyName ?? "client").replace(/[\\/:*?"<>|]/g, "-").trim();
  const bytes = await bundle.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="Signed Documents - ${safe}.pdf"`,
      // Lets the caller (and us, in support) see what the bundle contains.
      "X-Bundle-Contents": included.join(" | "),
      "Cache-Control": "no-store",
    },
  });
}
