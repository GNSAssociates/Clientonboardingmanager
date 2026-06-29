import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await req.json();
    const {
      decision,
      outstandingFees,
      feeAmount,
      concerns,
      transferMethod,
      respondentName,
      respondentFirm,
    } = body;

    if (!decision || !respondentName || !respondentFirm) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();
    const link = await db.transaction((tx) =>
      getOnboardingLinkByToken(tx, params.token)
    );

    if (!link) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const firm = getFirm(link.firmSlug || "gns");
    const today = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

    const isAccepted = decision === "accept";
    const statusLabel = isAccepted ? "GRANTED ✅" : "WITHHELD ⚠️";

    // Email to the firm
    await sendMail({
      to: firm.email,
      subject: `Professional Clearance ${isAccepted ? "Granted" : "Withheld"} — ${link.companyName}`,
      html: `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-top:4px solid ${firm.accentColor};padding-top:16px;margin-bottom:20px">
    <h2 style="margin:0">Professional Clearance Response</h2>
    <p style="color:#666;font-size:13px;margin:4px 0 0">${today}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <tr><td style="padding:6px 0;color:#666;width:180px">Company</td><td style="padding:6px 0;font-weight:bold">${link.companyName} (${link.companyNumber})</td></tr>
    <tr><td style="padding:6px 0;color:#666">Director</td><td style="padding:6px 0">${link.directorName ?? "—"}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Previous Accountant</td><td style="padding:6px 0">${respondentName} · ${respondentFirm}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Decision</td><td style="padding:6px 0;font-weight:bold">${statusLabel}</td></tr>
    ${outstandingFees === "yes" ? `<tr><td style="padding:6px 0;color:#666">Outstanding Fees</td><td style="padding:6px 0;color:#cc2229;font-weight:bold">${feeAmount || "Amount not specified"}</td></tr>` : ""}
    ${isAccepted ? `<tr><td style="padding:6px 0;color:#666">Records Transfer</td><td style="padding:6px 0">${transferMethod}</td></tr>` : ""}
  </table>
  ${concerns ? `<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:20px"><p style="font-size:13px;color:#555;margin:0 0 6px;font-weight:bold">Additional Notes:</p><p style="font-size:13px;color:#333;margin:0">${concerns}</p></div>` : ""}
  <div style="background:${isAccepted ? "#f0fdf4" : "#fef2f2"};border:1px solid ${isAccepted ? "#86efac" : "#fca5a5"};border-radius:8px;padding:16px">
    <p style="font-size:14px;font-weight:bold;color:${isAccepted ? "#166534" : "#991b1b"};margin:0 0 6px">
      ${isAccepted ? "Action: Proceed with onboarding. Contact previous accountant to arrange records transfer." : "Action: Clearance withheld. Review the notes above before proceeding."}
    </p>
  </div>
</body></html>`,
    });

    // Confirmation email to the previous accountant
    await sendMail({
      to: link.clientEmail, // We use clientEmail as proxy — in production store prevAccountantEmail on the link
      subject: `Clearance Response Received — ${link.companyName}`,
      replyTo: firm.email,
      html: `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
  <p>Dear ${respondentName},</p>
  <p>Thank you for responding to our professional clearance request regarding <strong>${link.companyName}</strong>.</p>
  <p>We have recorded your response as: <strong>${statusLabel}</strong></p>
  <p>${isAccepted ? "We will be in touch to arrange the transfer of records." : "A member of our team will review your response and be in touch shortly."}</p>
  <p>Yours faithfully,<br><strong>${firm.legalName}</strong><br>
  <a href="mailto:${firm.email}">${firm.email}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
  <p style="font-size:11px;color:#999">${firm.regStatement}</p>
</body></html>`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Clearance respond error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
