import { NextRequest, NextResponse } from "next/server";
import { getFirm } from "@/lib/firms";
import { buildLetterHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";

export const dynamic = "force-dynamic";

// Render the engagement letter for preview BEFORE a link is created, so the
// letter can be checked and adjusted prior to sending to the client. This is a
// pure template renderer over the data supplied in the request — it reads
// nothing from the database, so it needs no session (the wizard is used by
// staff who may not have a staff-portal cookie yet).
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    firmSlug?: string;
    companyName?: string;
    companyNumber?: string;
    clientAddress?: string;
    directorName?: string;
    partnerName?: string;
    regBody?: string;
    services?: LetterService[];
    customFees?: CustomFee[];
    scopeRows?: ScopeRow[];
    ch?: ChDetails | null;
    paymentMethod?: string;
    includeAnnexA?: boolean;
    clientType?: string;
    clientName?: string;
    businessAddress?: string;
    utr?: string;
  };

  if (!body.companyName) {
    return NextResponse.json({ error: "companyName required" }, { status: 400 });
  }

  const firm = getFirm(body.firmSlug || "gns");
  const html = buildLetterHtml({
    firm,
    regBody: body.regBody === "ICAEW" || body.regBody === "ACCA" ? body.regBody : firm.regBody,
    companyName: body.companyName,
    companyNumber: body.companyNumber,
    clientAddress: body.businessAddress || body.clientAddress,
    directorName: body.directorName,
    partnerName: body.partnerName,
    services: body.services ?? [],
    customFees: body.customFees ?? [],
    scopeRows: body.scopeRows,
    ch: body.ch ?? null,
    dateStr: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    paymentMethod: body.paymentMethod,
    includeAnnexA: body.includeAnnexA,
    clientType: body.clientType,
    clientName: body.clientName,
    utr: body.utr,
  });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
