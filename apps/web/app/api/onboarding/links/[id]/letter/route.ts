import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { buildLetterHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";

export const dynamic = "force-dynamic";

/**
 * Serve the engagement letter for a link.
 *   ?signed=1    → the signed copy (with audit certificate), 404 if not signed yet
 *   ?download=1  → adds Content-Disposition so the browser saves the file
 * Used by: the client signing page (iframe), staff "View letter", staff download.
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

  let html: string | null = null;
  if (wantSigned) {
    html = link.signedHtml ?? null;
    if (!html) return NextResponse.json({ error: "Not signed yet" }, { status: 404 });
  } else {
    html = link.letterHtml ?? null;
  }

  // Older links have no stored snapshot — build from link data on the fly
  if (!html) {
    const meta = (link.letterMeta ?? {}) as {
      partnerName?: string; customFees?: CustomFee[]; scopeRows?: ScopeRow[];
      clientAddress?: string; ch?: ChDetails | null;
    };
    html = buildLetterHtml({
      firm: getFirm(link.firmSlug || "gns"),
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
  if (download) {
    const name = `${wantSigned ? "SIGNED - " : ""}Engagement Letter - ${(link.companyName ?? "client").replace(/[\\/:*?"<>|]/g, "-")}.html`;
    headers["Content-Disposition"] = `attachment; filename="${name}"`;
  }
  return new NextResponse(html, { headers });
}
