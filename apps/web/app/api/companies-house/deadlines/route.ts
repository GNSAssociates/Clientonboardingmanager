import { NextRequest, NextResponse } from "next/server";
import { getDb, listAllLinks } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { fetchCompanyDeadlines, fetchDeadlinesForCompanies } from "@/lib/ch-deadlines";

export const dynamic = "force-dynamic";

/**
 * Companies House filing deadlines.
 *   GET /api/companies-house/deadlines?number=12345678  → one company
 *   GET /api/companies-house/deadlines                  → all onboarded clients
 *     with a company number, sorted by soonest deadline (overdue first).
 *     Optional ?within=90 limits the portfolio view to deadlines within N days.
 * Staff-only.
 */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const number = req.nextUrl.searchParams.get("number");
  if (number) {
    const deadlines = await fetchCompanyDeadlines(number);
    return NextResponse.json({ deadlines });
  }

  // Portfolio view: every onboarded client that has a company number.
  const withinRaw = Number(req.nextUrl.searchParams.get("within"));
  const within = Number.isFinite(withinRaw) && withinRaw > 0 ? withinRaw : null;

  const db = getDb();
  const links = await db.transaction((tx) => listAllLinks(tx));
  const byNumber = new Map<string, { companyName: string | null }>();
  for (const l of links) {
    if (l.companyNumber) byNumber.set(l.companyNumber.trim(), { companyName: l.companyName ?? null });
  }

  let deadlines = await fetchDeadlinesForCompanies(Array.from(byNumber.keys()));
  // Prefer the client name we hold if CH didn't return one.
  deadlines = deadlines.map((d) => ({
    ...d,
    companyName: d.companyName ?? byNumber.get(d.companyNumber)?.companyName ?? null,
  }));
  if (within != null) {
    deadlines = deadlines.filter(
      (d) => d.nextDeadlineDaysLeft != null && d.nextDeadlineDaysLeft <= within,
    );
  }

  const summary = {
    total: deadlines.length,
    overdue: deadlines.filter((d) => d.urgency === "overdue").length,
    dueSoon: deadlines.filter((d) => d.urgency === "due-soon").length,
    upcoming: deadlines.filter((d) => d.urgency === "upcoming").length,
  };
  return NextResponse.json({ summary, deadlines });
}
