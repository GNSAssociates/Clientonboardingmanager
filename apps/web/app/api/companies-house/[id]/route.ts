import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

  let companyRes: Response;
  let officersRes: Response;
  try {
    [companyRes, officersRes] = await Promise.all([
      fetch(`https://api.companieshouse.gov.uk/company/${companyNumber}`, {
        headers: { Authorization: authHeader },
      }),
      fetch(`https://api.companieshouse.gov.uk/company/${companyNumber}/officers`, {
        headers: { Authorization: authHeader },
      }),
    ]);
  } catch (err) {
    console.error("CH API network error:", err);
    return NextResponse.json({ error: "Could not reach Companies House API" }, { status: 502 });
  }

  if (companyRes.status === 404) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
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
  const address = [
    addr.address_line_1,
    addr.address_line_2,
    addr.locality,
    addr.region,
    addr.postal_code,
  ].filter(Boolean).join(", ");

  let officers: Array<{ name: string }> = [];
  if (officersRes.ok) {
    const officerData = await officersRes.json();
    officers = (officerData.items || [])
      .filter((o: { officer_role: string; resigned_on?: string }) =>
        o.officer_role === "director" && !o.resigned_on
      )
      .map((o: { name: string }) => ({
        name: o.name
          .split(",")
          .reverse()
          .map((p: string) => p.trim())
          .join(" "),
      }));
  }

  const sicCodes: string[] = data.sic_codes || [];

  return NextResponse.json({
    number: data.company_number,
    name: data.company_name,
    address,
    status: data.company_status,
    officers,
    incorporationDate: data.date_of_creation ?? null,
    aaDue: data.accounts?.next_due ?? data.accounts?.next_accounts?.due_on ?? null,
    csDue: data.confirmation_statement?.next_due ?? null,
    sicCodes,
    natureOfBusiness: sicCodes.length > 0 ? sicCodes.join(", ") : null,
  });
}
