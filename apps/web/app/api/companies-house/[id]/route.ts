import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const raw = params.id.replace(/\s/g, "").toUpperCase();
  // LLP numbers start with letter prefixes (OC, SO, NC) — don't zero-pad those
  const companyNumber = /^[A-Z]/.test(raw) ? raw : raw.padStart(8, "0");

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Companies House API key not configured" }, { status: 503 });
  }

  try {
    const authHeader = { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` };

    const [companyRes, officersRes] = await Promise.all([
      fetch(`https://api.companieshouse.gov.uk/company/${companyNumber}`, { headers: authHeader }),
      fetch(`https://api.companieshouse.gov.uk/company/${companyNumber}/officers`, { headers: authHeader }),
    ]);

    if (!companyRes.ok) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
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
  } catch (error) {
    console.error("Error looking up company:", error);
    return NextResponse.json({ error: "Failed to lookup company" }, { status: 500 });
  }
}
