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

    // Send engagement letter email to director
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const engagementUrl = `${appUrl}/onboarding/engage/${token}`;

    const { getFirm } = await import("@/lib/firms");
    const { sendMail } = await import("@/lib/mailer");
    const { buildEngagementLetterEmail } = await import("@/lib/email-constants");
    const firm = getFirm(firmSlug);
    const expiryStr = expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // Send email — failure is non-fatal, link is already saved to DB
    let emailSent = false;
    try {
      await sendMail({
        to: directorEmail,
        subject: `Engagement Letter — ${companyName} & ${firm.legalName}`,
        replyTo: firm.email,
        html: buildEngagementLetterEmail({
          firm,
          companyName,
          companyNumber: companyNumber ?? "",
          directorName: directorName ?? "",
          services: (serviceDetails || []).map((s: { name: string; price: number }) => ({ name: s.name, price: s.price })),
          engagementUrl,
          expiresAt: expiryStr,
          today,
        }),
      });
      emailSent = true;
    } catch (emailErr) {
      console.error("Email send failed (link still created):", emailErr instanceof Error ? emailErr.message : emailErr);
    }

    console.log(`✓ Onboarding link created: ${engagementUrl} | email sent: ${emailSent}`);

    return NextResponse.json({
      success: true,
      token,
      linkId: link.id,
      engagementUrl: `/onboarding/engage/${token}`,
      expiresAt: expiresAt.toISOString(),
      emailSent: true,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error creating onboarding link:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
