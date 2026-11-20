/**
 * CRM sync, for the staff screen.
 *
 *   GET                         → is the CRM connected, recent runs, counts
 *   POST { action: "start" }    → start a sync (or return the one running)
 *   POST { action: "step", runId } → do the next ~20 seconds of it
 *
 * The screen calls "step" in a loop and shows progress; closing the page just
 * pauses it, and the nightly cron (./cron) carries on from where it stopped.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { leadsSession } from "@/lib/leads-auth";
import { crmConfigured, latestRuns, crmCounts, startRun, stepRun } from "@/lib/crm-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [runs, counts] = await Promise.all([latestRuns(5), crmCounts()]);
    return NextResponse.json({ configured: crmConfigured(), runs, counts });
  } catch (e) {
    console.error("crm status failed:", e);
    return NextResponse.json({ error: "could_not_load" }, { status: 500 });
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("step"), runId: z.string().uuid() }),
]);

export async function POST(req: NextRequest) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!crmConfigured()) {
    return NextResponse.json({ error: "The CRM is not connected: CRM_API_KEY is not set on the server." }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    if (parsed.data.action === "start") {
      const run = await startRun("manual", session.displayName ?? session.userId);
      return NextResponse.json({ run });
    }
    const run = await stepRun(parsed.data.runId, 20000);
    return NextResponse.json({ run });
  } catch (e) {
    console.error("crm sync failed:", e);
    return NextResponse.json({ error: "could_not_sync" }, { status: 500 });
  }
}
