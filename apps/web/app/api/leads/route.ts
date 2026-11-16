/**
 * Leads for the staff screen: the list (GET) and adding one by hand (POST).
 *
 * Adding by hand covers what the website cannot see: a phone call, an email
 * straight to info@, a referral from an existing client. They go through the
 * same normaliser as the website, so a typed lead and a web lead look alike.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseLead, LEAD_STATUSES, type LeadSource } from "@/lib/lead-parse";
import { insertLead, listLeads, leadCounts, type LeadView } from "@/lib/lead-store";
import { leadsSession, leadsSecretConfigured } from "@/lib/leads-auth";
import { FIRMS } from "@/lib/firms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIEWS = new Set<string>(["open", "all", ...LEAD_STATUSES]);

export async function GET(req: NextRequest) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const viewParam = req.nextUrl.searchParams.get("view") ?? "open";
  const view = (VIEWS.has(viewParam) ? viewParam : "open") as LeadView;
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);

  try {
    const [leads, counts] = await Promise.all([listLeads(view, q), leadCounts()]);
    return NextResponse.json({ leads, counts, websiteConnected: leadsSecretConfigured() });
  } catch (e) {
    console.error("list leads failed:", e);
    return NextResponse.json({ error: "could_not_load" }, { status: 500 });
  }
}

const addSchema = z.object({
  source: z.enum(["email", "phone", "referral", "walk_in", "other", "website"]),
  name: z.string().max(200).optional().default(""),
  email: z.string().max(200).optional().default(""),
  phone: z.string().max(50).optional().default(""),
  companyName: z.string().max(300).optional().default(""),
  companyNumber: z.string().max(20).optional().default(""),
  services: z.string().max(1000).optional().default(""),
  message: z.string().max(5000).optional().default(""),
  firmSlug: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedBody = addSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "bad_request", details: parsedBody.error.format() }, { status: 400 });
  }
  const b = parsedBody.data;
  if (!b.name.trim() && !b.companyName.trim()) {
    return NextResponse.json({ error: "A name or a company is needed." }, { status: 400 });
  }

  const lead = parseLead({
    name: b.name, email: b.email, phone: b.phone,
    company_name: b.companyName, company_number: b.companyNumber,
    services: b.services, message: b.message,
  });
  // Staff typed this in themselves: it is not spam, whatever the heuristics say.
  lead.looksLikeSpam = false;
  lead.spamReason = null;

  try {
    const { id } = await insertLead(lead, {
      source: b.source as LeadSource,
      firmSlug: b.firmSlug && b.firmSlug in FIRMS ? b.firmSlug : null,
      createdBy: session.userId,
      notes: b.notes ?? null,
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    console.error("add lead failed:", e);
    return NextResponse.json({ error: "could_not_save" }, { status: 500 });
  }
}
