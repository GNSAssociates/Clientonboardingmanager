import { NextResponse } from "next/server";
import { getDb, getAllFirmsStats } from "@gns/db";
import { FIRMS } from "@/lib/firms";

export async function GET() {
  try {
    const db = getDb();
    const stats = await db.transaction((tx) => getAllFirmsStats(tx));

    const firms = Object.values(FIRMS).map((firm) => {
      const s = stats.find((x) => x.slug === firm.slug) ?? {
        slug: firm.slug,
        total: 0,
        sent: 0,
        accepted: 0,
        expired: 0,
        monthlyRevenue: 0,
      };
      return {
        ...s,
        name: firm.legalName,
        shortName: firm.name,
        accentColor: firm.accentColor,
        companyNumber: firm.companyNumber,
        email: firm.email,
        partnerName: firm.partnerName,
        annualRevenue: s.monthlyRevenue * 12,
      };
    });

    const totals = {
      total: firms.reduce((s, f) => s + f.total, 0),
      sent: firms.reduce((s, f) => s + f.sent, 0),
      accepted: firms.reduce((s, f) => s + f.accepted, 0),
      expired: firms.reduce((s, f) => s + f.expired, 0),
      monthlyRevenue: firms.reduce((s, f) => s + f.monthlyRevenue, 0),
      annualRevenue: firms.reduce((s, f) => s + f.annualRevenue, 0),
    };

    return NextResponse.json({ firms, totals });
  } catch (err) {
    console.error("All firms stats error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
