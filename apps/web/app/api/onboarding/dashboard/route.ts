import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingStats } from "@gns/db";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();

    // Get the entity from session
    const entityId = session.entityIds?.[0] || "gns";

    const stats = await db.transaction((tx) =>
      getOnboardingStats(tx, entityId)
    );

    // Map to friendly format
    return NextResponse.json({
      firm: "GNS Associates", // Would come from entity config
      total: stats.total,
      sent: stats.sent,
      accepted: stats.accepted,
      expired: stats.expired,
      links: stats.links.map((link) => ({
        id: link.id,
        companyName: link.companyName,
        clientEmail: link.clientEmail,
        status: link.status,
        expiresAt: link.expiresAt.toISOString(),
        createdAt: link.createdAt.toISOString(),
        resendCount: link.resendCount,
      })),
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}
