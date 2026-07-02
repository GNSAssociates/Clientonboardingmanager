import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { buildLetterHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";

export const dynamic = "force-dynamic";

// Staff-only: render the engagement letter for preview BEFORE a link is created,
// so the letter can be checked and adjusted prior to sending to the client.
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    firmSlug?: string;
    companyName?: string;
    companyNumber?: string;
    clientAddress?: string;
    directorName?: string;
    partnerName?: string;
    services?: LetterService[];
    customFees?: CustomFee[];
    scopeRows?: ScopeRow[];
    ch?: ChDetails | null;
  };

  if (!body.companyName) {
    return NextResponse.json({ error: "companyName required" }, { status: 400 });
  }

  const html = buildLetterHtml({
    firm: getFirm(body.firmSlug || "gns"),
    companyName: body.companyName,
    companyNumber: body.companyNumber,
    clientAddress: body.clientAddress,
    directorName: body.directorName,
    partnerName: body.partnerName,
    services: body.services ?? [],
    customFees: body.customFees ?? [],
    scopeRows: body.scopeRows,
    ch: body.ch ?? null,
    dateStr: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
