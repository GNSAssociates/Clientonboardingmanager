import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { buildLetterHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";
import { loadEngagementLetterOverrides } from "@/lib/template-overrides.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Serve the engagement letter for a link.
 *   ?pdf=1      → a print-ready page that auto-opens the browser's own
 *                 "Save as PDF" dialog. Reliable on any host (no server PDF
 *                 engine), and the browser renders the letter faithfully.
 *   ?signed=1   → the signed copy, 404 if not signed yet
 *   ?download=1 → download the raw HTML
 * Used by: the client signing page (iframe, HTML), staff "View / Download".
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wantSigned = req.nextUrl.searchParams.get("signed") === "1";
  // Rebuild the letter from the CURRENT template instead of serving the copy
  // stored when the link was created. Needed because a fix to the letter template
  // otherwise only reaches letters created afterwards — an engagement already sent
  // keeps rendering the old markup forever.
  //
  // NEVER applies to a signed letter: signedHtml is the executed contract and the
  // document the audit certificate hashes, so regenerating it would invalidate the
  // signature record.
  const wantRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const wantPdf = req.nextUrl.searchParams.get("pdf") === "1";
  const wantDocx = req.nextUrl.searchParams.get("docx") === "1";

  const meta = (link.letterMeta ?? {}) as {
    partnerName?: string; customFees?: CustomFee[]; scopeRows?: ScopeRow[];
    clientAddress?: string; ch?: ChDetails | null; regBody?: string;
    firstViewedAt?: string; firstViewIp?: string;
  };
  const firm = getFirm(link.firmSlug || "gns");

  const baseName = `${wantSigned ? "SIGNED - " : ""}Engagement Letter - ${(link.companyName ?? "client").replace(/[\\/:*?"<>|]/g, "-")}`;

  // Resolve the letter HTML: stored signed copy, stored letter, or freshly built.
  let html: string | null = wantSigned ? (link.signedHtml ?? null) : (wantRefresh ? null : (link.letterHtml ?? null));
  if (wantSigned && !html) return NextResponse.json({ error: "Not signed yet" }, { status: 404 });
  if (!html) {
    const overrides = await loadEngagementLetterOverrides(firm.slug);
    html = buildLetterHtml({
      firm,
      ...overrides,
      regBody: meta.regBody ?? firm.regBody,
      companyName: link.companyName ?? "",
      companyNumber: link.companyNumber ?? undefined,
      clientAddress: meta.clientAddress,
      directorName: link.directorName ?? undefined,
      partnerName: meta.partnerName,
      services: (link.services ?? []) as LetterService[],
      customFees: meta.customFees ?? [],
      scopeRows: meta.scopeRows,
      ch: meta.ch ?? null,
      dateStr: new Date(link.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
  }

  // Print corrections, applied on EVERY letter response so any print path (the
  // download button, or just viewing then Ctrl+P) is fixed — not only ?pdf=1.
  // Letters issued before these fixes are stored with the old stylesheet, so the
  // corrections are re-applied here as a late override (last rule wins). Only
  // @media print is touched, so the on-screen signing view is unchanged.
  const printFix =
    `<style>` +
    // Generous reserved margins give the running header/footer a band of their
    // own (the last @page wins over the stored stylesheet).
    // top | right | bottom | left — narrower right margin (see letter-html.ts).
    `@page{size:A4;margin:30mm 6.4mm 26mm 16mm !important;}` +
    `@media print{` +
    `html,body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}` +
    `.lh,.rule,.rule2{display:none !important;}` +
    `.meta{display:flex !important;margin-top:0 !important;}` +
    // Header/footer sit inside the margins, opaque and above content.
    `.print-header{top:6mm !important;bottom:auto !important;height:15mm !important;padding-bottom:3px !important;` +
    `border-bottom:2px solid ${firm.accentColor} !important;background:#fff !important;z-index:1000 !important;}` +
    `.print-header img{height:9mm !important;}` +
    `.print-footer{bottom:6mm !important;top:auto !important;height:13mm !important;padding-top:3px !important;` +
    `align-items:flex-start !important;background:#fff !important;z-index:1000 !important;}` +
    // Stop table headers from being repeated at the top of each page (where they
    // collided with the letterhead), and keep the fee/scope tables whole so they
    // move to the next page intact instead of straddling a page break.
    `thead{display:table-row-group !important;}` +
    `table,tr,.fees,.scope,.ssc{page-break-inside:avoid !important;break-inside:avoid !important;}` +
    `}</style>`;

  if (wantDocx && !wantSigned) {
    // Editable Word (.docx) copy — same content/wording as the PDF, for firms
    // that prefer to tweak in Word before sending.
    try {
      const { buildEngagementDocx, engagementDocxFilename } = await import("@/lib/engagement-docx");
      const m = (link.letterMeta ?? {}) as Record<string, unknown>;
      const docx = await buildEngagementDocx({
        firm,
        regBody: meta.regBody ?? firm.regBody,
        companyName: link.companyName ?? "",
        companyNumber: link.companyNumber ?? undefined,
        clientAddress: meta.clientAddress,
        directorName: link.directorName ?? undefined,
        partnerName: meta.partnerName,
        services: (link.services ?? []) as LetterService[],
        customFees: meta.customFees ?? [],
        scopeRows: meta.scopeRows ?? undefined,
        ch: meta.ch ?? null,
        paymentMethod: m.paymentMethod as string | undefined,
        includeAnnexA: m.includeAnnexA as boolean | undefined,
        clientType: m.clientType as string | undefined,
        clientName: m.clientName as string | undefined,
        utr: m.utr as string | undefined,
        dateStr: new Date(link.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      });
      return new NextResponse(new Uint8Array(docx), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${engagementDocxFilename(link.companyName ?? "client")}"`,
        },
      });
    } catch (e) {
      console.error("buildEngagementDocx failed:", e);
      return NextResponse.json({ error: "Could not build the Word document." }, { status: 500 });
    }
  }

  if (wantPdf) {
    // Preferred: a real, server-generated PDF (proper A4 letterhead on every
    // page, controlled pagination, small file) for BOTH the unsigned letter and
    // the signed copy. The signed copy adds a signature-confirmation stamp built
    // from the stored acceptance record. Runs on cPanel (react-pdf does not).
    try {
      const { buildEngagementPdf, engagementPdfFilename } = await import("@/lib/engagement-pdf");
      const m = (link.letterMeta ?? {}) as Record<string, unknown>;
      // Acceptance record (signatory + timestamp + audit) for the signed copy.
      const acc = (link as { acceptanceData?: Record<string, unknown> }).acceptanceData ?? {};
      const audit = (acc.audit ?? {}) as Record<string, unknown>;
      const signedFields = wantSigned
        ? {
            signedName: (acc.signatureName as string) || link.directorName || undefined,
            signedAt: (acc.signedAt as string) || undefined,
            signedIp: (audit.ipAddress as string) || undefined,
            // Full audit trail → Adobe-style Certificate of Completion page on
            // the client-facing signed download, matching the archived copy.
            audit: {
              signatureName: (acc.signatureName as string) || link.directorName || "",
              signedAtIso: (acc.signedAt as string) || new Date(link.sentAt).toISOString(),
              signerEmail: link.clientEmail,
              companyName: link.companyName ?? "",
              companyNumber: link.companyNumber ?? undefined,
              ipAddress: (audit.ipAddress as string) || undefined,
              userAgent: (audit.userAgent as string) || undefined,
              documentSha256: (audit.documentSha256 as string) || undefined,
              ddSummary: (audit.ddSummary as string) ?? undefined,
              token: link.token,
              firmName: firm.legalName,
              firmEmail: firm.email,
              createdAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
              emailedAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
              firstViewedAtIso: (m.firstViewedAt as string) ?? null,
              firstViewIp: (m.firstViewIp as string) ?? null,
            },
          }
        : {};
      const pdf = await buildEngagementPdf({
        firm,
        regBody: meta.regBody ?? firm.regBody,
        companyName: link.companyName ?? "",
        companyNumber: link.companyNumber ?? undefined,
        clientAddress: meta.clientAddress,
        directorName: link.directorName ?? undefined,
        partnerName: meta.partnerName,
        services: (link.services ?? []) as LetterService[],
        customFees: meta.customFees ?? [],
        scopeRows: meta.scopeRows ?? undefined,
        ch: meta.ch ?? null,
        paymentMethod: m.paymentMethod as string | undefined,
        includeAnnexA: m.includeAnnexA as boolean | undefined,
        clientType: m.clientType as string | undefined,
        clientName: m.clientName as string | undefined,
        utr: m.utr as string | undefined,
        dateStr: new Date(link.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        ...signedFields,
      });
      const fname = `${wantSigned ? "SIGNED - " : ""}${engagementPdfFilename(link.companyName ?? "client")}`;
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fname}"`,
        },
      });
    } catch (e) {
      // Any failure → fall through to the browser-print HTML fallback below.
      console.error("buildEngagementPdf failed, using browser-print fallback:", e);
    }

    // Fallback: print-ready page that opens the browser's Save-as-PDF dialog.
    const inject =
      printFix +
      `<script>document.title=${JSON.stringify(baseName)};` +
      `window.addEventListener('load',function(){setTimeout(function(){try{window.print();}catch(e){}},400);});</script>`;
    const printHtml = html.includes("</body>") ? html.replace("</body>", `${inject}</body>`) : html + inject;
    return new NextResponse(printHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Plain view / download — inject the same print corrections so Ctrl+P is right.
  html = html.includes("</body>") ? html.replace("</body>", `${printFix}</body>`) : html + printFix;
  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
  if (download) headers["Content-Disposition"] = `attachment; filename="${baseName}.html"`;
  return new NextResponse(html, { headers });
}
