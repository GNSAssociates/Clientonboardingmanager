import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { buildLetterHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";

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
  const download = req.nextUrl.searchParams.get("download") === "1";
  const wantPdf = req.nextUrl.searchParams.get("pdf") === "1";

  const meta = (link.letterMeta ?? {}) as {
    partnerName?: string; customFees?: CustomFee[]; scopeRows?: ScopeRow[];
    clientAddress?: string; ch?: ChDetails | null; regBody?: string;
    firstViewedAt?: string; firstViewIp?: string;
  };
  const firm = getFirm(link.firmSlug || "gns");

  const baseName = `${wantSigned ? "SIGNED - " : ""}Engagement Letter - ${(link.companyName ?? "client").replace(/[\\/:*?"<>|]/g, "-")}`;

  // Resolve the letter HTML: stored signed copy, stored letter, or freshly built.
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

  // ?pdf=1 → print-ready page: name the document (so the saved file is sensible)
  // and auto-open the browser's Save-as-PDF dialog on load.
  if (wantPdf) {
    const inject =
      `<script>document.title=${JSON.stringify(baseName)};` +
      `window.addEventListener('load',function(){setTimeout(function(){try{window.print();}catch(e){}},400);});</script>`;
    const printHtml = html.includes("</body>") ? html.replace("</body>", `${inject}</body>`) : html + inject;
    return new NextResponse(printHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
  if (download) headers["Content-Disposition"] = `attachment; filename="${baseName}.html"`;
  return new NextResponse(html, { headers });
}
