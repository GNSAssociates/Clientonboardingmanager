import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getFirm } from "@/lib/firms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PDF-engine diagnostic (operator-only). Tries the real @react-pdf engagement
 * letter generator and reports whether it works on THIS host, plus the exact
 * error + stack if it doesn't — so we know whether it's fixable or we must fall
 * back to a pdf-lib rebuild. Locked behind AUTH_SHIM_SECRET; 404 otherwise.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.AUTH_SHIM_SECRET ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!secret || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { renderLetterPdf } = await import("@/lib/letter-pdf");
    const firm = getFirm("gns");
    const pdf = await renderLetterPdf({
      firm,
      regBody: firm.regBody,
      companyName: "DIAGNOSTIC TEST LTD",
      companyNumber: "00000000",
      directorName: "Test Director",
      partnerName: firm.partnerName,
      services: [{ name: "Annual Accounts and Corporation Tax", price: 150, frequency: "monthly" }],
      customFees: [],
      dateStr: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      audit: null,
    });
    return NextResponse.json({
      ok: true,
      engine: "@react-pdf/renderer",
      bytes: pdf.length,
      magic: pdf.subarray(0, 5).toString("latin1"),
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({
      ok: false,
      engine: "@react-pdf/renderer",
      error: err?.message ?? String(e),
      name: err?.name,
      stack: (err?.stack ?? "").split("\n").slice(0, 8),
    });
  }
}
