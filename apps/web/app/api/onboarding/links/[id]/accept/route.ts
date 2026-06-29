import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = params.id;
  const body = await req.json();

  const {
    prevFirmName,
    prevEmail,
    prevPhone,
    noPrevAccountant,
    docsAcknowledged,
    authorised,
  } = body;

  if (!authorised) {
    return NextResponse.json({ error: "Declaration not accepted" }, { status: 400 });
  }

  try {
    const db = getDb();

    const link = await db.transaction((tx) =>
      getOnboardingLinkByToken(tx, token)
    );

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (new Date(link.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Link has expired" }, { status: 410 });
    }

    if (link.status === "accepted") {
      return NextResponse.json({ error: "Already accepted" }, { status: 409 });
    }

    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        status: "accepted",
        acceptedAt: new Date(),
      })
    );

    const firm = getFirm(link.firmSlug || "gns");
    const services = (link.services as Array<{ name: string; price: number }> || []);
    const totalMonthly = services.reduce((s, sv) => s + sv.price, 0);
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const serviceRows = services.map((s) =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${s.name}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right">£${s.price}/month</td></tr>`
    ).join("");

    // ── EMAIL 1: To Previous Accountant (with clearance response link) ────────
    if (!noPrevAccountant && prevEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const clearanceUrl = `${appUrl}/clearance/respond/${token}`;

      await sendMail({
        to: prevEmail,
        subject: `Professional Clearance Request — ${link.companyName}`,
        replyTo: firm.email,
        html: `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-top:4px solid ${firm.accentColor};padding-top:20px;margin-bottom:24px">
    <h2 style="margin:0;color:#111">${firm.legalName}</h2>
    <p style="margin:4px 0 0;color:#666;font-size:13px">${firm.address}, ${firm.city}, ${firm.postcode}</p>
  </div>
  <p style="color:#666;font-size:13px">${today}</p>
  <p>Dear ${prevFirmName || "Previous Accountant"},</p>
  <p>We are writing to inform you that <strong>${link.companyName}</strong> (Company No. ${link.companyNumber ?? "—"}) has appointed <strong>${firm.legalName}</strong> as their new accountants with effect from ${today}.</p>
  <p>The director, <strong>${link.directorName ?? link.clientEmail}</strong>, has authorised us to contact you to request professional clearance and the handover of accounting records.</p>
  <p>Please click the button below to submit your clearance response, note any outstanding fees, and confirm how you will transfer the records:</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${clearanceUrl}" style="background:${firm.accentColor};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
      Respond to Clearance Request →
    </a>
  </div>
  <p style="font-size:13px;color:#666">Or copy this link into your browser:<br>
  <a href="${clearanceUrl}" style="color:${firm.accentColor};word-break:break-all;font-size:12px">${clearanceUrl}</a></p>
  <p>Records we require (where held):</p>
  <ul style="padding-left:20px;color:#555;font-size:14px">
    <li>Latest filed statutory accounts and corporation tax computations (CT600)</li>
    <li>Prior year working papers and trial balance</li>
    <li>Payroll records and employee details (if applicable)</li>
    <li>VAT returns history</li>
    <li>HMRC correspondence and reference numbers</li>
    <li>Accounting software access (Xero, QuickBooks, Sage etc.)</li>
  </ul>
  <p>Please respond within <strong>14 days</strong>. If we do not hear from you we will assume there are no matters to draw to our attention.</p>
  <p>Yours faithfully,<br><strong>${firm.legalName}</strong><br>
  <a href="mailto:${firm.email}" style="color:${firm.accentColor}">${firm.email}</a> · ${firm.phone}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#999">${firm.regStatement}</p>
</body></html>`,
      });
    }

    // ── EMAIL 2: To the Firm ──────────────────────────────────────────────────
    await sendMail({
      to: firm.email,
      subject: `✅ New Client Onboarded — ${link.companyName}`,
      html: `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-top:4px solid ${firm.accentColor};padding-top:20px;margin-bottom:24px">
    <h2 style="margin:0;color:#111">New Client Onboarding Confirmed</h2>
    <p style="color:#666;font-size:13px">${today}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <tr><td style="padding:8px 0;color:#666;width:160px">Company</td><td style="padding:8px 0;font-weight:bold">${link.companyName}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Company No.</td><td style="padding:8px 0">${link.companyNumber ?? "—"}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Director</td><td style="padding:8px 0">${link.directorName ?? "—"}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Director Email</td><td style="padding:8px 0"><a href="mailto:${link.clientEmail}">${link.clientEmail}</a></td></tr>
    <tr><td style="padding:8px 0;color:#666">Firm</td><td style="padding:8px 0">${firm.legalName}</td></tr>
  </table>
  <h3 style="font-size:14px;color:#555;margin-bottom:8px">Services Agreed</h3>
  <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px">
    <thead><tr style="background:#f9f5ff"><th style="padding:8px 12px;text-align:left;font-size:13px">Service</th><th style="padding:8px 12px;text-align:right;font-size:13px">Monthly Fee</th></tr></thead>
    <tbody>${serviceRows}</tbody>
    <tfoot><tr style="background:#f3f0ff"><td style="padding:8px 12px;font-weight:bold">Total Monthly</td><td style="padding:8px 12px;text-align:right;font-weight:bold;color:${firm.accentColor}">£${totalMonthly}</td></tr></tfoot>
  </table>
  <h3 style="font-size:14px;color:#555;margin-bottom:8px">Previous Accountant</h3>
  <p>${noPrevAccountant ? "None — new business (no clearance required)" : `${prevFirmName} · ${prevEmail} · ${prevPhone ?? "—"}`}</p>
  <h3 style="font-size:14px;color:#555;margin-bottom:8px">Action Required</h3>
  <ol>
    <li>Create client record in the system</li>
    <li>${!noPrevAccountant ? `Await professional clearance from <strong>${prevFirmName}</strong>` : "No clearance required — new business"}</li>
    <li>Schedule welcome call with <strong>${link.directorName ?? link.clientEmail}</strong></li>
    <li>Issue first invoice</li>
  </ol>
  ${docsAcknowledged?.length ? `<p style="font-size:12px;color:#888">Docs acknowledged: ${docsAcknowledged.join(", ")}</p>` : ""}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#999">${firm.regStatement}</p>
</body></html>`,
    });

    // ── EMAIL 3: Confirmation to Client ──────────────────────────────────────
    await sendMail({
      to: link.clientEmail,
      subject: `Engagement Confirmed — Welcome to ${firm.legalName}`,
      replyTo: firm.email,
      html: `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-top:4px solid ${firm.accentColor};padding-top:20px;margin-bottom:24px">
    <h2 style="margin:0;color:#111">${firm.legalName}</h2>
    <p style="margin:4px 0 0;color:#666;font-size:13px">${firm.address}, ${firm.city}, ${firm.postcode}</p>
  </div>
  <p>Dear ${link.directorName ?? "Director"},</p>
  <p>Thank you for completing your engagement with <strong>${firm.legalName}</strong>. We are delighted to welcome <strong>${link.companyName}</strong> as a new client.</p>
  <p>Your engagement has been confirmed as of <strong>${today}</strong>.</p>
  ${!noPrevAccountant ? `<p>We have contacted your previous accountant, <strong>${prevFirmName}</strong>, to arrange the professional handover of your records. We will keep you informed of progress.</p>` : ""}
  <h3 style="font-size:14px;color:#555;margin-bottom:8px">What happens next?</h3>
  <ol>
    <li>A member of our team will be in touch within <strong>2 business days</strong> to schedule a welcome call</li>
    ${!noPrevAccountant ? `<li>We will chase your previous accountant for your records within <strong>14 days</strong></li>` : ""}
    <li>We will set up your client portal and begin work on your agreed services</li>
  </ol>
  <p>If you have any questions in the meantime, please don't hesitate to contact us:</p>
  <p><strong>${firm.legalName}</strong><br>
  📧 <a href="mailto:${firm.email}" style="color:${firm.accentColor}">${firm.email}</a><br>
  📞 ${firm.phone}</p>
  <p>Yours sincerely,<br><strong>${firm.legalName}</strong></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#999">${firm.regStatement}</p>
</body></html>`,
    });

    return NextResponse.json({
      success: true,
      message: !noPrevAccountant
        ? "Engagement accepted. Previous accountant contacted and firm notified."
        : "Engagement accepted. Firm notified.",
    });
  } catch (error) {
    console.error("Error accepting engagement:", error);
    return NextResponse.json({ error: "Failed to accept engagement" }, { status: 500 });
  }
}
