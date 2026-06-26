import { NextRequest, NextResponse } from "next/server";
import { getDb, createOnboardingLink } from "@gns/db";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      entityId,
      companyName,
      companyNumber,
      clientEmail,
      prevAccountantName,
      prevAccountantEmail,
      prevAccountantPhone,
      services,
      prices,
    } = body;

    if (!entityId || !companyName || !clientEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Generate unique token
    const token = randomBytes(32).toString("hex");

    // 30-day expiry
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create onboarding link in database
    const link = await db.transaction((tx) =>
      createOnboardingLink(tx, {
        entityId,
        token,
        companyNumber,
        companyName,
        clientEmail,
        status: "sent",
        sentAt: new Date(),
        expiresAt,
        resendCount: "0",
      })
    );

    // TODO: Send email to client with the engagement link
    // const engagementLink = `${process.env.APP_URL}/onboarding/engage/${token}`;
    // await mailer.send({
    //   to: clientEmail,
    //   subject: `Complete Your ${companyName} Onboarding with ${FIRM_INFO[entityId]?.name || 'Our Firm'}`,
    //   template: 'engagement-link',
    //   data: {
    //     companyName,
    //     engagementLink,
    //     expiresAt,
    //     services,
    //   }
    // });

    // TODO: Send email to previous accountant requesting records (if provided)
    // if (prevAccountantEmail) {
    //   await mailer.send({
    //     to: prevAccountantEmail,
    //     subject: `Records Request: ${companyName}`,
    //     template: 'records-request',
    //     data: {
    //       companyName,
    //       contactName: prevAccountantName,
    //       contactEmail: clientEmail,
    //       contactPhone: prevAccountantPhone,
    //     }
    //   });
    // }

    console.log(`✓ Onboarding link created: ${token}`);
    console.log(`  - Company: ${companyName}`);
    console.log(`  - Client email: ${clientEmail}`);
    console.log(`  - Link expires: ${expiresAt.toISOString()}`);
    console.log(`  - Engagement URL: /onboarding/engage/${token}`);

    return NextResponse.json({
      success: true,
      token,
      linkId: link.id,
      engagementUrl: `/onboarding/engage/${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating onboarding link:", error);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}
