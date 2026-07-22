import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { buildLetterHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails, type AuditData } from "@/lib/letter-html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Serve the engagement letter for a link.
 *   ?pdf=1       → a real downloadable PDF (react-pdf), with the firm header and
 *                  "Page X of Y" footer on every page, plus the signature audit
 *                  report for signed copies. No browser needed.
 *   ?signed=1    → the signed copy (audit report), 404 if not signed yet
 *   ?download=1  → force a download (default for PDF is inline)
 * Used by: the client signing page (iframe, HTML), staff "View letter", downloads.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wantSigned = req.nextUrl.searchParams.get("signed") === "1";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const wantPdf = req.nextUrl.searchParams.get("pdf") === "1";

  const meta = (link.letterMeta ?? {}) as {
    partnerName?: string; customFees?: CustomFee[]; scopeRows?: ScopeRow[];
    clientAddress?: string; ch?: ChDetails | null; regBody?: string;
    firstViewedAt?: string; firstViewIp?: string;
  };
  const firm = getFirm(link.firmSlug || "gns");
  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const isSignedAvailable = Boolean(link.signedHtml);

  const baseName = `${wantSigned ? "SIGNED - " : ""}Engagement Letter - ${(link.companyName ?? "client").replace(/[\\/:*?"<>|]/g, "-")}`;

  // ── Real PDF (react-pdf) ────────────────────────────────────────────────────
  if (wantPdf) {
    if (wantSigned && !isSignedAvailable) {
      return NextResponse.json({ error: "Not signed yet" }, { status: 404 });
    }
    const { renderLetterPdf } = await import("@/lib/letter-pdf");

    let audit: AuditData | null = null;
    if (wantSigned && isSignedAvailable) {
      const a = (acc.audit ?? {}) as { ipAddress?: string; userAgent?: string; documentSha256?: string };
      const dd = acc.directDebit as { accountName?: string; accountNumber?: string; sortCode?: string } | null;
      audit = {
        signatureName: (acc.signatureName as string) ?? link.directorName ?? "",
        signedAtIso: (acc.signedAt as string) ?? new Date(link.acceptedAt ?? Date.now()).toISOString(),
        signerEmail: link.clientEmail,
        companyName: link.companyName ?? "",
        companyNumber: link.companyNumber ?? undefined,
        ipAddress: a.ipAddress,
        userAgent: a.userAgent,
        documentSha256: a.documentSha256,
        contactPrefs: (acc.contactPrefs as string[]) ?? [],
        ddSummary: dd?.accountName
          ? `${dd.accountName} · ****${String(dd.accountNumber ?? "").replace(/\D/g, "").slice(-4)} · ${String(dd.sortCode ?? "").replace(/\D/g, "").slice(0, 2)}-**-**`
          : null,
        token: link.token,
        firmName: firm.legalName,
        firmEmail: firm.email,
        createdAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
        emailedAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
        firstViewedAtIso: meta.firstViewedAt ?? null,
        firstViewIp: meta.firstViewIp ?? null,
      };
    }

    const pdf = await renderLetterPdf({
      firm,
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
      audit,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${baseName}.pdf"`,
      },
    });
  }

  // ── HTML (on-screen viewing / signing iframe) ───────────────────────────────
  let html: string | null = wantSigned ? (link.signedHtml ?? null) : (link.letterHtml ?? null);
  if (wantSigned && !html) return NextResponse.json({ error: "Not signed yet" }, { status: 404 });

  if (!html) {
    html = buildLetterHtml({
      firm,
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

  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
  if (download) headers["Content-Disposition"] = `attachment; filename="${baseName}.html"`;
  return new NextResponse(html, { headers });
}
