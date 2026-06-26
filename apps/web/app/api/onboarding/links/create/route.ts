import { NextRequest, NextResponse } from "next/server";
import { getDb, createOnboardingLink } from "@gns/db";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firmSlug,
      entityId,
      companyName,
      companyNumber,
      companyAddress,
      directorName,
      directorEmail,
      serviceDetails,
    } = body;

    if (!firmSlug || !companyName || !directorEmail) {
      return NextResponse.json(
        { error: "Missing required fields: firmSlug, companyName, directorEmail" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Generate cryptographically secure token
    const token = randomBytes(32).toString("hex");

    // 30-day expiry
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // entityId is optional — firmSlug is the authoritative firm identifier on this table
    const resolvedEntityId = entityId && /^[0-9a-f-]{36}$/i.test(entityId) ? entityId : null;

    // Create onboarding link in database
    const link = await db.transaction((tx) =>
      createOnboardingLink(tx, {
        entityId: resolvedEntityId,
        token,
        companyNumber,
        companyName,
        clientEmail: directorEmail,
        directorName,
        directorEmail,
        firmSlug,
        services: serviceDetails || [],
        status: "sent",
        sentAt: new Date(),
        expiresAt,
        resendCount: "0",
      })
    );

    // TODO: Send engagement letter email to director
    // const engagementLink = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/engage/${token}`;
    // await sendEngagementEmail({
    //   to: directorEmail,
    //   firmName: FIRM_INFO[firmSlug].name,
    //   companyName,
    //   directorName,
    //   services: serviceDetails,
    //   engagementLink,
    //   expiresAt,
    // });

    console.log(`✓ Onboarding link created for ${companyName}`);
    console.log(`  Token: ${token.substring(0, 16)}...`);
    console.log(`  Director: ${directorName} <${directorEmail}>`);
    console.log(`  Expires: ${expiresAt.toLocaleDateString('en-GB')}`);
    console.log(`  Engagement URL: /onboarding/engage/${token}`);

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
