/**
 * Nightly CRM sync, called by a cPanel cron job:
 *
 *   *\/10 0-5 * * *  curl -s "https://practiceagents.co.uk/api/crm/sync/cron?key=$CRON_SECRET" >/dev/null
 *
 * Every 10 minutes between midnight and 6am: if no full sync has finished in
 * the last 20 hours, one is started; a sync in progress is carried on for up
 * to 50 seconds per call. A full pass of ~520 CRM requests completes within
 * the window, one request at a time.
 *
 * Authorised by CRON_SECRET (Bearer header or ?key=). Unlike some older
 * routes, this one refuses to run at all when CRON_SECRET is not set.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { crmConfigured, latestRuns, startRun, stepRun } from "@/lib/crm-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return false;
  const auth = req.headers.get("authorization");
  const given = auth?.startsWith("Bearer ") ? auth.slice(7) : req.nextUrl.searchParams.get("key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!crmConfigured()) return NextResponse.json({ skipped: "CRM_API_KEY not set" });

  try {
    const runs = await latestRuns(5);
    const active = runs.find((r) => r.status === "listing" || r.status === "details");
    const lastDone = runs.find((r) => r.status === "done");
    const fresh = lastDone?.finishedAt && Date.now() - Date.parse(lastDone.finishedAt) < 20 * 3600 * 1000;

    if (!active && fresh) return NextResponse.json({ skipped: "synced recently", lastFinished: lastDone!.finishedAt });
    const run = active ?? (await startRun("cron", "nightly"));
    const after = await stepRun(run.id, 50000);
    return NextResponse.json({ run: after });
  } catch (e) {
    console.error("crm cron sync failed:", e);
    return NextResponse.json({ error: "could_not_sync" }, { status: 500 });
  }
}
