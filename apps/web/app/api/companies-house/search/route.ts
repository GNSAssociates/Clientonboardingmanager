import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Companies House API not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://api.companieshouse.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=10`,
      { headers: { Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}` } },
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'CH API error', status: res.status }, { status: 502 });
    }
    const data = await res.json() as { items?: Array<{ company_number: string; title: string; company_status: string; address_snippet?: string; date_of_creation?: string }> };
    const items = (data.items ?? []).map((c) => ({
      companyNumber: c.company_number,
      name: c.title,
      status: c.company_status,
      address: c.address_snippet ?? '',
      incorporationDate: c.date_of_creation ?? null,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
