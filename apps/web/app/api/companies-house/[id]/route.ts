import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CH_BASE = "https://api.companieshouse.gov.uk";

/** Reformat "SURNAME, Forename" → "Forename Surname". */
function reformatName(name: string): string {
  return name.split(",").reverse().map((p) => p.trim()).filter(Boolean).join(" ");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const raw = params.id.replace(/\s/g, "").toUpperCase();
  // LLP numbers start with letter prefixes (OC, SO, NC) — don't zero-pad those
  const companyNumber = /^[A-Z]/.test(raw) ? raw : raw.padStart(8, "0");

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!apiKey) {
    console.error("COMPANIES_HOUSE_API_KEY is not set");
    return NextResponse.json({ error: "Companies House API key not configured" }, { status: 503 });
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
  const get = (path: string) => fetch(`${CH_BASE}/company/${companyNumber}${path}`, { headers: { Authorization: authHeader } });

  // Deep pull: profile + officers + PSCs + recent filing history in parallel.
  let companyRes: Response, officersRes: Response, pscRes: Response, filingRes: Response;
  try {
    [companyRes, officersRes, pscRes, filingRes] = await Promise.all([
      get(""),
      get("/officers"),
      get("/persons-with-significant-control"),
      get("/filing-history?items_per_page=15"),
    ]);
  } catch (err) {
    console.error("CH API network error:", err);
    return NextResponse.json({ error: "Could not reach Companies House API" }, { status: 502 });
  }

  if (companyRes.status === 404) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (companyRes.status === 401 || companyRes.status === 403) {
    console.error("CH API auth error:", companyRes.status);
    return NextResponse.json({ error: "Companies House API authentication failed" }, { status: 502 });
  }
  if (!companyRes.ok) {
    console.error("CH API error:", companyRes.status, await companyRes.text().catch(() => ""));
    return NextResponse.json({ error: "Companies House API error" }, { status: 502 });
  }

  const data = await companyRes.json();
  const addr = data.registered_office_address || {};
  const address = [addr.address_line_1, addr.address_line_2, addr.locality, addr.region, addr.postal_code]
    .filter(Boolean).join(", ");

  // ── Officers ───────────────────────────────────────────────────────────────
  type ChOfficer = {
    name: string; officer_role: string; resigned_on?: string; appointed_on?: string;
    nationality?: string; occupation?: string; country_of_residence?: string;
    date_of_birth?: { month?: number; year?: number };
  };
  let officers: Array<{ name: string }> = [];
  let officersDetailed: Array<Record<string, unknown>> = [];
  if (officersRes.ok) {
    const od = await officersRes.json();
    const active = (od.items || []).filter((o: ChOfficer) => !o.resigned_on);
    officers = active
      .filter((o: ChOfficer) => o.officer_role === "director")
      .map((o: ChOfficer) => ({ name: reformatName(o.name) }));
    officersDetailed = active.map((o: ChOfficer) => ({
      name: reformatName(o.name),
      role: o.officer_role,
      appointedOn: o.appointed_on ?? null,
      nationality: o.nationality ?? null,
      occupation: o.occupation ?? null,
      countryOfResidence: o.country_of_residence ?? null,
      dob: o.date_of_birth ? `${o.date_of_birth.month ?? ""}/${o.date_of_birth.year ?? ""}`.replace(/^\//, "") : null,
    }));
  }

  // ── Persons with Significant Control ─────────────────────────────────────────
  type ChPsc = {
    name?: string; kind?: string; natures_of_control?: string[]; notified_on?: string; ceased_on?: string;
    nationality?: string; date_of_birth?: { month?: number; year?: number };
  };
  let pscs: Array<Record<string, unknown>> = [];
  if (pscRes.ok) {
    const pd = await pscRes.json();
    pscs = (pd.items || [])
      .filter((p: ChPsc) => !p.ceased_on)
      .map((p: ChPsc) => ({
        name: p.name ? reformatName(p.name) : null,
        kind: (p.kind || "").replace(/-/g, " "),
        naturesOfControl: (p.natures_of_control || []).map((n) => n.replace(/-/g, " ")),
        nationality: p.nationality ?? null,
        notifiedOn: p.notified_on ?? null,
      }));
  }

  // ── Recent filing history ────────────────────────────────────────────────────
  type ChFiling = { date?: string; type?: string; description?: string; category?: string };
  let filingHistory: Array<Record<string, unknown>> = [];
  if (filingRes.ok) {
    const fd = await filingRes.json();
    filingHistory = (fd.items || []).slice(0, 15).map((it: ChFiling) => ({
      date: it.date ?? null,
      type: it.type ?? null,
      category: it.category ?? null,
      description: (it.description || "").replace(/-/g, " "),
    }));
  }

  const sicCodes: string[] = data.sic_codes || [];

  return NextResponse.json({
    number: data.company_number,
    name: data.company_name,
    type: data.type ?? null,
    address,
    registeredOffice: addr,
    status: data.company_status,
    officers,            // active directors (name only) — backward compatible
    officersDetailed,    // all active officers with role/DOB/nationality (KYC)
    pscs,                // persons with significant control
    filingHistory,       // last 15 filings
    incorporationDate: data.date_of_creation ?? null,
    aaDue: data.accounts?.next_due ?? data.accounts?.next_accounts?.due_on ?? null,
    aaLastMadeUpTo: data.accounts?.last_accounts?.made_up_to ?? null,
    csDue: data.confirmation_statement?.next_due ?? null,
    csLastMadeUpTo: data.confirmation_statement?.last_made_up_to ?? null,
    sicCodes,
    natureOfBusiness: sicCodes.length > 0 ? sicCodes.join(", ") : null,
  });
}
