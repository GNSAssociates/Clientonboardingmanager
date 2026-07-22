import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@gns/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const companyNumber = req.nextUrl.searchParams.get('companyNumber')?.trim();
  const companyName = req.nextUrl.searchParams.get('companyName')?.trim();
  if (!companyNumber && !companyName) {
    return NextResponse.json({ duplicates: [] });
  }

  try {
    const db = getDb();
    const conditions: string[] = [];
    const params: string[] = [];
    if (companyNumber) {
      conditions.push(`company_number = $${params.length + 1}`);
      params.push(companyNumber);
    }
    if (companyName) {
      conditions.push(`LOWER(company_name) = LOWER($${params.length + 1})`);
      params.push(companyName);
    }

    const rows = await db.execute(
      sql.raw(`SELECT token, company_name, company_number, status, firm_slug, accepted_at, sent_at
        FROM onboarding_links
        WHERE (${conditions.join(' OR ')}) AND status != 'draft'
        ORDER BY sent_at DESC
        LIMIT 10`),
    ) as unknown as Array<Record<string, unknown>>;

    const duplicates = (rows ?? []).map((r) => ({
      token: r.token,
      companyName: r.company_name,
      companyNumber: r.company_number,
      status: r.status,
      firmSlug: r.firm_slug,
      acceptedAt: r.accepted_at,
      sentAt: r.sent_at,
    }));

    return NextResponse.json({ duplicates });
  } catch (e) {
    console.error('Duplicate check error:', e);
    return NextResponse.json({ duplicates: [] });
  }
}
