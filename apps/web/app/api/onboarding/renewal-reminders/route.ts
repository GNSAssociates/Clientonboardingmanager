import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sendRenewalReminders } from "@/lib/renewal-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Emails each firm a digest of clients due for annual re-engagement (~11 months
// after signing). Run WEEKLY via a cPanel cron. Authorised by a Bearer
// {CRON_SECRET} header, a ?key={CRON_SECRET} query param, or a staff session.
async function run(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  const isCron = !!cronSecret && (authHeader === `Bearer ${cronSecret}` || key === cronSecret);
  const session = getSession();
  if (!isCron && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendRenewalReminders();
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
