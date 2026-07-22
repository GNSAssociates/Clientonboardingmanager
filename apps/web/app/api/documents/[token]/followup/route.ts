import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getOnboardingLinkByToken,
  getDocumentCompletionStatus,
  incrementDocFollowUp,
} from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";
import { DOCUMENT_TYPES, REQUIRED_DOC_IDS, getMissingRequiredDocs } from "@/lib/document-types";

export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const db = getDb();
    const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.token));
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const completion = await db.transaction((tx) =>
      getDocumentCompletionStatus(tx, params.token, REQUIRED_DOC_IDS)
    );

    if (completion.isComplete) {
      return NextResponse.json({ error: "All required documents already uploaded" }, { status: 409 });
    }

    const firm = getFirm(link.firmSlug || "gns");
    const missing = getMissingRequiredDocs(
      completion.rows.filter((r) => r.status === "uploaded").map((r) => r.docType)
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const uploadUrl = `${appUrl}/onboarding/documents/${params.token}`;
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const followUpNum = (completion.rows[0]?.followUpCount ?? 0) + 1;
    const uploaded = REQUIRED_DOC_IDS.length - missing.length;
    const pct = Math.round((uploaded / REQUIRED_DOC_IDS.length) * 100);

    const missingListHtml = missing.map((d) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6">
          <p style="margin:0;font-size:13px;font-weight:600;color:#1a1a2e">${d.label}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280">${d.description}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#9ca3af;font-style:italic">${d.hint}</p>
        </td>
      </tr>`).join("");

    const urgencyMsg = followUpNum === 1
      ? "We notice that some required documents are still missing from your onboarding file."
      : followUpNum === 2
      ? "This is a second reminder — we are still waiting for some required documents before we can complete your onboarding."
      : "This is an urgent final reminder. We cannot proceed with your accounting services until all required documents are received.";

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td height="5" style="background:linear-gradient(90deg,${firm.accentColor},#1e3a8a);font-size:0">&nbsp;</td></tr>

  <!-- Header -->
  <tr><td style="padding:28px 36px 20px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#111">${firm.legalName}</p>
    <p style="margin:2px 0 0;font-size:12px;color:#6b7280">${firm.address}, ${firm.city}, ${firm.postcode}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280">${today}</p>
  </td></tr>

  <!-- Intro -->
  <tr><td style="padding:0 36px 20px">
    <p style="margin:0 0 12px;font-size:15px;color:#374151">Dear ${link.directorName || "Director"},</p>
    <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.7">${urgencyMsg}</p>
  </td></tr>

  <!-- Progress bar -->
  <tr><td style="padding:0 36px 20px">
    <div style="background:#f3f4f6;border-radius:8px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:12px;font-weight:600;color:#374151">Document Progress</span>
        <span style="font-size:12px;font-weight:700;color:${firm.accentColor}">${uploaded} of ${REQUIRED_DOC_IDS.length} required documents received</span>
      </div>
      <div style="background:#e5e7eb;height:8px;border-radius:4px;overflow:hidden">
        <div style="height:100%;border-radius:4px;background:linear-gradient(90deg,${firm.accentColor},#1e3a8a);width:${pct}%"></div>
      </div>
    </div>
  </td></tr>

  <!-- Missing docs table -->
  <tr><td style="padding:0 36px 20px">
    <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#111">Documents Still Required:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      ${missingListHtml}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 36px 24px;text-align:center">
    <p style="margin:0 0 16px;font-size:14px;color:#374151">Please click below to access your secure document upload portal:</p>
    <a href="${uploadUrl}" style="display:inline-block;background:linear-gradient(135deg,${firm.accentColor},#1e3a8a);color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(0,0,0,0.18)">
      Upload Documents Now →
    </a>
    <p style="margin:12px 0 0;font-size:11px;color:#9ca3af">
      Or copy: <a href="${uploadUrl}" style="color:${firm.accentColor};word-break:break-all">${uploadUrl}</a>
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 36px 28px;background:#f8f9fb;border-top:1px solid #e8eaed">
    <p style="margin:0;font-size:13px;color:#374151">
      If you have any questions, please contact us at
      <a href="mailto:${firm.email}" style="color:${firm.accentColor}">${firm.email}</a> or call ${firm.phone}.
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:#9ca3af">${firm.regStatement}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

    await sendMail({
      to: link.clientEmail,
      toName: link.directorName || undefined,
      subject: `Action Required: ${missing.length} document${missing.length !== 1 ? "s" : ""} still needed — ${link.companyName}`,
      replyTo: firm.email,
      html,
    });

    await db.transaction((tx) => incrementDocFollowUp(tx, params.token));

    return NextResponse.json({ success: true, followUpNumber: followUpNum, missingCount: missing.length });
  } catch (err) {
    console.error("Doc follow-up error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
