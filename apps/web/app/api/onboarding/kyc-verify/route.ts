import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { verifyIdDocument, isKycConfigured } from "@/lib/kyc-verify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI KYC check. Staff-only. Body:
 *   { base64, mediaType, expectedName?, expectedDob? }
 * Returns the extracted ID fields plus name/DOB/expiry match flags.
 */
export async function POST(req: NextRequest) {
  if (!getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isKycConfigured()) {
    return NextResponse.json({ ok: false, error: "Set ANTHROPIC_API_KEY in the app .env to enable KYC." }, { status: 503 });
  }

  let body: { base64?: string; mediaType?: string; expectedName?: string; expectedDob?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const base64 = (body.base64 || "").replace(/^data:[^;]+;base64,/, "");
  if (!base64) return NextResponse.json({ ok: false, error: "No document supplied." }, { status: 400 });

  // Guard payload size (~8MB decoded) to protect memory / NPROC.
  if (Math.floor((base64.length * 3) / 4) > 8 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Document too large (max 8 MB)." }, { status: 413 });
  }

  const result = await verifyIdDocument({
    base64,
    mediaType: body.mediaType || "image/jpeg",
    expectedName: body.expectedName?.trim() || undefined,
    expectedDob: body.expectedDob?.trim() || undefined,
  });
  return NextResponse.json(result);
}
