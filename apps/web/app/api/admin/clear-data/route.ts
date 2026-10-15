import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@gns/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Wipe all onboarding data for a fresh start — keeps the code and configuration,
 * removes the sample/test client records entered so far. Staff only, and the
 * caller must send { confirm: "DELETE ALL" } to avoid accidents.
 */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  /* ADMIN ONLY. "Logged in" was the whole check, so the most junior account —
     or anyone holding any session at all — could delete every engagement,
     clearance request and document record in the live database. The confirm
     word stops an accident; it does nothing about who is asking. */
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE ALL") {
    return NextResponse.json({ error: 'Send { "confirm": "DELETE ALL" } to proceed' }, { status: 400 });
  }

  /* AND NOT AGAINST THE LIVE DATABASE BY ACCIDENT. A staging copy pointed at
     the production database would delete production rows from a screen marked
     "test". Set ALLOW_CLEAR_DATA=yes deliberately, on the machine where it is
     meant to be possible. */
  if (process.env.ALLOW_CLEAR_DATA !== "yes") {
    return NextResponse.json(
      { error: "Disabled here. Set ALLOW_CLEAR_DATA=yes on the machine where this is intended." },
      { status: 403 },
    );
  }

  try {
    const db = getDb();
    const counts: Record<string, number> = {};
    const tables = [
      "clearance_followups",
      "professional_clearance_requests",
      "document_submissions",
      "onboarding_links",
    ];
    for (const t of tables) {
      try {
        const res = await db.execute(sql.raw(`DELETE FROM ${t}`)) as unknown as { count?: number };
        counts[t] = res?.count ?? 0;
      } catch (e) {
        // Table may not exist in every environment — skip
        console.warn(`clear-data: skipped ${t}:`, e instanceof Error ? e.message : e);
      }
    }
    return NextResponse.json({ success: true, cleared: counts });
  } catch (error) {
    console.error("Error clearing data:", error);
    return NextResponse.json({ error: "Failed to clear data" }, { status: 500 });
  }
}
