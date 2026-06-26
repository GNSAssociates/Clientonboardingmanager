import { NextRequest, NextResponse } from "next/server";

// Mock Companies House data for demo - replace with real API in production
const MOCK_COMPANIES = {
  "12345678": {
    number: "12345678",
    name: "Tech Innovations Ltd",
    address: "123 Silicon Valley, London, SW1A 1AA, United Kingdom",
    status: "active",
    officers: [
      { name: "John Smith", email: "john@techinnovations.com" },
      { name: "Sarah Johnson", email: "sarah@techinnovations.com" },
    ],
  },
  "87654321": {
    number: "87654321",
    name: "Global Trading Partners LLP",
    address: "456 Commerce Street, Edinburgh, EH1 3AA, United Kingdom",
    status: "active",
    officers: [
      { name: "Michael Chen", email: "m.chen@globaltrading.com" },
      { name: "Emma Wilson", email: "e.wilson@globaltrading.com" },
    ],
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const companyNumber = params.id.toUpperCase();

  try {
    // Check mock data first
    const mockData = MOCK_COMPANIES[companyNumber as keyof typeof MOCK_COMPANIES];
    if (mockData) {
      return NextResponse.json(mockData);
    }

    // In production, call the real Companies House API
    // const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    // if (!apiKey) {
    //   return NextResponse.json(
    //     { error: "Companies House API key not configured" },
    //     { status: 500 }
    //   );
    // }
    //
    // const res = await fetch(
    //   `https://api.companieshouse.gov.uk/company/${companyNumber}`,
    //   {
    //     headers: {
    //       Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    //     },
    //   }
    // );
    //
    // if (!res.ok) {
    //   return NextResponse.json(
    //     { error: "Company not found" },
    //     { status: 404 }
    //   );
    // }
    //
    // const data = await res.json();
    // return NextResponse.json({
    //   number: data.company_number,
    //   name: data.company_name,
    //   address: `${data.registered_office_address.address_line_1}, ${data.registered_office_address.locality}, ${data.registered_office_address.postal_code}`,
    //   status: data.company_status,
    //   officers: data.officers || [],
    // });

    // For now, return 404 for non-mock companies
    return NextResponse.json(
      { error: "Company not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error looking up company:", error);
    return NextResponse.json(
      { error: "Failed to lookup company" },
      { status: 500 }
    );
  }
}
