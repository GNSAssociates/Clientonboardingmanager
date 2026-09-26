import { NextRequest, NextResponse } from "next/server";
import { getFirm } from "@/lib/firms";
import { getSession } from "@/lib/auth/session";
import { FIRMS_WITH_648, read648Taxes } from "@/lib/form-648-shared";

export const dynamic = "force-dynamic";

/**
 * Staff preview of the 64-8, from the wizard, before the engagement exists.
 *
 * The wizard has no link to render against yet, so this takes the details as
 * they stand and renders the form directly. Always a SPECIMEN: it shows a
 * signature nobody has given, so it is banded on every page and could not be
 * mistaken for — or sent to HMRC as — a real authorisation.
 */
export async function POST(req: NextRequest) {
  if (!getSession()) {
    return NextResponse.json({ error: "Staff sign-in required." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    firmSlug?: string;
    clientName?: string;
    companyName?: string;
    companyNumber?: string;
    address?: string;
    utr?: string;
    taxes?: Record<string, boolean>;
  };

  const firm = getFirm(body.firmSlug || "gns");
  if (!FIRMS_WITH_648.has(firm.slug)) {
    return NextResponse.json(
      { error: `${firm.legalName} has no HMRC agent codes set up, so a 64-8 cannot be produced for it.` },
      { status: 400 },
    );
  }

  const { buildForm648Bytes } = await import("@/lib/form-648-pdf");
  const pdf = await buildForm648Bytes({
    firm,
    // Placeholders make it obvious which boxes the client's own record fills.
    clientName: body.clientName?.trim() || "[ Signatory name ]",
    companyName: body.companyName?.trim() || null,
    companyNumber: body.companyNumber?.trim() || null,
    address: body.address?.trim() || null,
    utr: body.utr?.trim() || null,
    taxes: read648Taxes(body.taxes),
    signedName: body.clientName?.trim() || "[ Signatory name ]",
    signedAt: new Date().toISOString(),
    specimen: true,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="SPECIMEN 64-8 - ${firm.legalName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
