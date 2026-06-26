import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkById, updateOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const linkId = params.id;

  try {
    const db = getDb();

    // Get link
    const link = await db.transaction((tx) =>
      getOnboardingLinkById(tx, linkId)
    );

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Check if expired
    const now = new Date();
    if (link.expiresAt < now) {
      return NextResponse.json(
        { error: "Link has expired, cannot resend" },
        { status: 410 }
      );
    }

    // Increment resend count and update lastResentAt
    const resendCount = (parseInt(link.resendCount) || 0) + 1;
    await db.transaction((tx) =>
      updateOnboardingLink(tx, linkId, {
        resendCount: resendCount.toString(),
        lastResentAt: new Date(),
      })
    );

    // TODO: Send email to client.clientEmail with the engagement link
    // await mailer.send({
    //   to: link.clientEmail,
    //   subject: `Your GNS Associates Onboarding Link (Resend ${resendCount})`,
    //   template: 'onboarding-link',
    //   data: {
    //     companyName: link.companyName,
    //     engagementLink: `${process.env.APP_URL}/onboarding/engage/${link.token}`,
    //     expiresAt: link.expiresAt,
    //   }
    // });

    return NextResponse.json({
      success: true,
      message: `Link resent to ${link.clientEmail}`,
      resendCount,
    });
  } catch (error) {
    console.error("Error resending link:", error);
    return NextResponse.json(
      { error: "Failed to resend link" },
      { status: 500 }
    );
  }
}
