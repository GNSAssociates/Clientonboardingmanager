import { NextRequest, NextResponse } from "next/server";

// Seed data — real entries plus test fixtures.
// Add COMPANIES_HOUSE_API_KEY to .env to enable live lookups for unknown numbers.
const MOCK_COMPANIES: Record<string, {
  number: string; name: string; address: string; status: string;
  officers: Array<{ name: string; email?: string }>;
}> = {
  // GNS Associates Limited — real entry (CH 08086819)
  "08086819": {
    number: "08086819",
    name: "GNS Associates Limited",
    address: "Devonshire Business Centres, Boundary House, Cricket Field Road, Uxbridge, Middlesex, UB8 1QG",
    status: "active",
    officers: [
      { name: "Gurdeep Singh" },
      { name: "Navdeep Singh" },
    ],
  },
  // Test fixtures
  "12345678": {
    number: "12345678",
    name: "Tech Innovations Ltd",
    address: "123 Silicon Valley, London, SW1A 1AA",
    status: "active",
    officers: [
      { name: "John Smith", email: "john@techinnovations.com" },
      { name: "Sarah Johnson", email: "sarah@techinnovations.com" },
    ],
  },
  "87654321": {
    number: "87654321",
    name: "Global Trading Partners LLP",
    address: "456 Commerce Street, Edinburgh, EH1 3AA",
    status: "active",
    officers: [
      { name: "Michael Chen", email: "m.chen@globaltrading.com" },
    ],
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Normalise: Companies House numbers are 8 chars, zero-padded
  const raw = params.id.replace(/\s/g, "").toUpperCase();
  const companyNumber = raw.padStart(8, "0");

  try {
    // 1. Check seed / known companies first
    const mockData = MOCK_COMPANIES[companyNumber] ?? MOCK_COMPANIES[raw];
    if (mockData) {
      return NextResponse.json(mockData);
    }

    // 2. Try the real Companies House API if key is configured
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (apiKey) {
      const [companyRes, officersRes] = await Promise.all([
        fetch(`https://api.companieshouse.gov.uk/company/${companyNumber}`, {
          headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` },
        }),
        fetch(`https://api.companieshouse.gov.uk/company/${companyNumber}/officers`, {
          headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` },
        }),
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

      return NextResponse.json({
        number: data.company_number,
        name: data.company_name,
        address,
        status: data.company_status,
        officers,
      });
    }

    // 3. No API key — return 404
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  } catch (error) {
    console.error("Error looking up company:", error);
    return NextResponse.json({ error: "Failed to lookup company" }, { status: 500 });
  }
}
