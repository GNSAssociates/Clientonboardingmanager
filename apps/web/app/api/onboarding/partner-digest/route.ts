import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sendPartnerDigest } from "@/lib/partner-digest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Emails info@ the weekly onboarding/revenue digest. Run WEEKLY via cPanel cron.
// Authorised by Bearer {CRON_SECRET}, ?key={CRON_SECRET}, or a staff session.
async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  const isCron = !!cronSecret && (authHeader === `Bearer ${cronSecret}` || key === cronSecret);
  if (!isCron && !getSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendPartnerDigest();
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
