/**
 * The local copy of the CRM's companies.
 *
 *   GET ?view=all|unmatched|verification|problems|gone&q=…   → list
 *   GET ?id=<crm id>                                         → one company in full
 *   POST { action: "create_client", crmId, firmSlug? }        → start a draft client from it
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { leadsSession } from "@/lib/leads-auth";
import { listCrmCompanies, getCrmCompany, createClientFromCrm, type CrmView } from "@/lib/crm-sync";

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

const createSchema = z.object({
  action: z.literal("create_client"),
  crmId: z.string().min(1).max(64),
  firmSlug: z.string().max(32).optional(),
});

export async function POST(req: NextRequest) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const r = await createClientFromCrm(parsed.data.crmId, {
      by: session.displayName ?? session.userId,
      firmSlug: parsed.data.firmSlug,
    });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 404 });
    return NextResponse.json(r);
  } catch (e) {
    console.error("crm create client failed:", e);
    return NextResponse.json({ error: "Could not create the client." }, { status: 500 });
  }
}
