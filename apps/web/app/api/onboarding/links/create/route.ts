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
    const firm = getFirm(firmSlug);
    const expiryStr = expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const serviceRows = (serviceDetails || []).map((s: { name: string; price: number }) =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #f3f3f3">${s.name}</td><td style="padding:6px 12px;text-align:right;border-bottom:1px solid #f3f3f3">£${s.price}/month</td></tr>`
    ).join("");
    const totalMonthly = (serviceDetails || []).reduce((sum: number, s: { price: number }) => sum + s.price, 0);

    await sendMail({
      to: directorEmail,
      subject: `Engagement Letter — ${companyName} & ${firm.legalName}`,
      replyTo: firm.email,
      html: `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-top:4px solid ${firm.accentColor};padding-top:20px;margin-bottom:24px">
    <h2 style="margin:0;color:#111">${firm.legalName}</h2>
    <p style="margin:4px 0 0;color:#666;font-size:13px">${firm.address}, ${firm.city}, ${firm.postcode}</p>
  </div>
  <p>Dear ${directorName || "Director"},</p>
  <p>We are pleased to confirm that <strong>${firm.legalName}</strong> has prepared an engagement letter for <strong>${companyName}</strong>.</p>
  <p>Please click the button below to review and accept your engagement letter online. This link expires on <strong>${expiryStr}</strong>.</p>
  <div style="text-align:center;margin:32px 0">
    <a href="${engagementUrl}" style="background:${firm.accentColor};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
      Review &amp; Sign Engagement Letter →
    </a>
  </div>
  ${serviceRows ? `
  <h3 style="font-size:14px;color:#555">Services Agreed</h3>
  <table style="width:100%;border-collapse:collapse;border:1px solid #eee">
    ${serviceRows}
    <tr style="background:#f9f5ff"><td style="padding:8px 12px;font-weight:bold">Total Monthly</td><td style="padding:8px 12px;text-align:right;font-weight:bold">£${totalMonthly}</td></tr>
  </table>` : ""}
  <p style="margin-top:24px;font-size:13px;color:#666">If the button doesn't work, copy this link into your browser:<br>
  <a href="${engagementUrl}" style="color:${firm.accentColor};word-break:break-all">${engagementUrl}</a></p>
  <p>If you have any questions please contact us at <a href="mailto:${firm.email}">${firm.email}</a>.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#999">${firm.regStatement}</p>
</body></html>`,
    });

    console.log(`✓ Onboarding link created: ${engagementUrl}`);

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
