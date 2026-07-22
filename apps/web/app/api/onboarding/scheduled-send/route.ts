import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dispatchDueScheduledSends } from "@/lib/scheduled-send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Sends any scheduled onboarding emails that are now due.
// Authorised by the Vercel cron bearer token OR a logged-in staff session
// (so staff can also flush the queue on demand).
async function run(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const session = getSession();
  if (!isCron && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await dispatchDueScheduledSends();
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
