/**
 * The local copy of the CRM's companies.
 *
 *   GET ?view=all|unmatched|verification|problems|gone&q=…   → list
 *   GET ?id=<crm id>                                         → one company in full
 */
import { NextRequest, NextResponse } from "next/server";
import { leadsSession } from "@/lib/leads-auth";
import { listCrmCompanies, getCrmCompany, type CrmView } from "@/lib/crm-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIEWS = new Set(["all", "unmatched", "verification", "problems", "gone"]);

export async function GET(req: NextRequest) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const company = await getCrmCompany(id.slice(0, 64));
      return company ? NextResponse.json({ company }) : NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const v = req.nextUrl.searchParams.get("view") ?? "all";
    const view = (VIEWS.has(v) ? v : "all") as CrmView;
    const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
    return NextResponse.json({ companies: await listCrmCompanies(view, q) });
  } catch (e) {
    console.error("crm companies failed:", e);
    return NextResponse.json({ error: "could_not_load" }, { status: 500 });
  }
}
