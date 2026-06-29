import { NextRequest, NextResponse } from "next/server";
import { getDb, getStatsByFirmSlug } from "@gns/db";
import { getFirm } from "@/lib/firms";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const firm = getFirm(params.slug);
    const db = getDb();
    const stats = await db.transaction((tx) => getStatsByFirmSlug(tx, params.slug));

    const recentLinks = stats.links.slice(0, 20).map((l) => ({
      id: l.id,
      token: l.token,
      companyName: l.companyName,
      companyNumber: l.companyNumber,
      clientEmail: l.clientEmail,
      directorName: l.directorName,
      status: l.status,
      expiresAt: l.expiresAt,
      acceptedAt: l.acceptedAt,
      createdAt: l.createdAt,
      services: l.services,
      prevAccountantEmail: l.prevAccountantEmail,
      prevAccountantFirmName: l.prevAccountantFirmName,
      clientFollowUpCount: l.clientFollowUpCount,
      prevAccountantFollowUpCount: l.prevAccountantFollowUpCount,
      clientFollowUpSentAt: l.clientFollowUpSentAt,
      prevAccountantFollowUpSentAt: l.prevAccountantFollowUpSentAt,
      resendCount: l.resendCount,
    }));

    return NextResponse.json({
      firm: {
        slug: firm.slug,
        name: firm.legalName,
        accentColor: firm.accentColor,
        email: firm.email,
        phone: firm.phone,
        partnerName: firm.partnerName,
      },
      stats: {
        total: stats.total,
        sent: stats.sent,
        accepted: stats.accepted,
        expired: stats.expired,
        expiringWithin7Days: stats.expiringWithin7Days,
        monthlyRevenue: stats.monthlyRevenue,
        annualRevenue: stats.monthlyRevenue * 12,
        pendingClearance: stats.pendingClearance,
      },
      links: recentLinks,
    });
  } catch (err) {
    console.error("Firm stats error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
