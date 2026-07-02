import { NextRequest, NextResponse } from "next/server";
import { getDb, createOnboardingLink } from "@gns/db";
import { randomBytes } from "crypto";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";
import { buildEngagementLetterEmail } from "@/lib/email-constants";
import { buildLetterHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";
import { archiveToClientFolder } from "@/lib/storage";
import { logoImg } from "@/lib/email-clearance";

export const dynamic = "force-dynamic";

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
      // Letter engine options
      partnerName,
      sendMode, // 'engagement' (default) | 'details_only'
      customFees,
      scopeRows,
      ch,
    } = body as {
      firmSlug?: string; entityId?: string; companyName?: string; companyNumber?: string;
      companyAddress?: string; directorName?: string; directorEmail?: string;
      serviceDetails?: LetterService[];
      partnerName?: string; sendMode?: string;
      customFees?: CustomFee[]; scopeRows?: ScopeRow[]; ch?: ChDetails | null;
    };

    if (!firmSlug || !companyName || !directorEmail) {
      return NextResponse.json(
        { error: "Missing required fields: firmSlug, companyName, directorEmail" },
        { status: 400 }
      );
    }

    const db = getDb();
    const mode = sendMode === "details_only" ? "details_only" : "engagement";
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const resolvedEntityId = entityId && /^[0-9a-f-]{36}$/i.test(entityId) ? entityId : null;

    const firm = getFirm(firmSlug);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const letterMeta = {
      sendMode: mode,
      partnerName: partnerName || firm.partnerName,
      customFees: customFees ?? [],
      scopeRows: scopeRows ?? null,
      clientAddress: companyAddress ?? ch?.address ?? "",
      ch: ch ?? null,
    };

    // Snapshot the letter exactly as issued (engagement mode only)
    let letterHtml: string | null = null;
    if (mode === "engagement") {
      letterHtml = buildLetterHtml({
        firm,
        companyName,
        companyNumber,
        clientAddress: letterMeta.clientAddress,
        directorName,
        partnerName: letterMeta.partnerName,
        services: serviceDetails ?? [],
        customFees: customFees ?? [],
        scopeRows: scopeRows ?? undefined,
        ch: ch ?? null,
        dateStr: today,
        appUrl,
      });
    }

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
        services: (serviceDetails || []).map((s) => ({ ...s, id: s.id ?? s.name })),
        status: "sent",
        sentAt: new Date(),
        expiresAt,
        resendCount: "0",
        letterMeta,
        letterHtml,
      })
    );

    // Archive to OneDrive (or Dropbox fallback) — non-fatal, no-op until configured
    let archivePath: string | null = null;
    if (letterHtml) {
      const archived = await archiveToClientFolder({
        companyName,
        fileName: `Engagement Letter - ${companyName} - ${today}.html`,
        content: letterHtml,
        mimeType: "text/html",
      });
      archivePath = archived ? `${archived.provider}:${archived.path}` : null;
    }

    const engagementUrl = `${appUrl}/onboarding/engage/${token}`;
    const expiryStr = expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // Send the client email — different for each mode. Failure is non-fatal.
    let emailSent = false;
    try {
      if (mode === "details_only") {
        await sendMail({
          to: directorEmail,
          toName: directorName || undefined,
          subject: `Action required: your previous accountant's details — ${companyName}`,
          replyTo: firm.email,
          html: buildDetailsOnlyEmail({
            firmAccent: firm.accentColor,
            firmLegal: firm.legalName,
            firmName: firm.name,
            firmEmail: firm.email,
            firmPhone: firm.phone,
            regStatement: firm.regStatement,
            logo: logoImg(firm),
            directorName: directorName || "Director",
            companyName,
            url: engagementUrl,
            expiryStr,
          }),
        });
      } else {
        await sendMail({
          to: directorEmail,
          subject: `Engagement Letter — ${companyName} & ${firm.legalName}`,
          replyTo: firm.email,
          html: buildEngagementLetterEmail({
            firm,
            companyName,
            companyNumber: companyNumber ?? "",
            directorName: directorName ?? "",
            services: (serviceDetails || []).map((s) => ({ name: s.name, price: s.price })),
            engagementUrl,
            expiresAt: expiryStr,
            today,
          }),
        });
      }
      emailSent = true;
    } catch (emailErr) {
      console.error("Email send failed (link still created):", emailErr instanceof Error ? emailErr.message : emailErr);
    }

    console.log(`✓ Onboarding link created (${mode}): ${engagementUrl} | email sent: ${emailSent} | archive: ${archivePath ?? "off"}`);

    return NextResponse.json({
      success: true,
      token,
      linkId: link.id,
      mode,
      engagementUrl: `/onboarding/engage/${token}`,
      expiresAt: expiresAt.toISOString(),
      emailSent,
      archivePath,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error creating onboarding link:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildDetailsOnlyEmail(d: {
  firmAccent: string; firmLegal: string; firmName: string; firmEmail: string; firmPhone: string;
  regStatement: string; logo: string; directorName: string; companyName: string; url: string; expiryStr: string;
}): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td height="5" style="background:linear-gradient(90deg,${d.firmAccent},#1e3a8a);font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:32px 36px">
    ${d.logo}
    <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#111">${d.firmLegal}</p>
    <p style="margin:0 0 14px;font-size:14px;color:#374151">Dear ${d.directorName},</p>
    <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
      As part of taking over the accounting affairs of <strong>${d.companyName}</strong>, we need to contact your
      previous accountant to request professional clearance and the handover of your records.
    </p>
    <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
      Please use the secure link below to provide your previous accountant's details — it takes less than a minute.
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="${d.url}" style="display:inline-block;background:${d.firmAccent};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px">
        Provide Previous Accountant Details
      </a>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
      This link is valid until <strong>${d.expiryStr}</strong>. If you did not expect this email, please contact us.
    </p>
    <p style="margin:24px 0 0;font-size:14px;color:#374151">
      Kind regards,<br><strong>${d.firmName}</strong><br>
      <span style="color:#6b7280;font-size:13px">${d.firmPhone} · ${d.firmEmail}</span>
    </p>
  </td></tr>
  <tr><td style="padding:16px 36px 24px;background:#f8f9fb;border-top:1px solid #e8eaed">
    <p style="margin:0;font-size:11px;color:#9ca3af">${d.regStatement}</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}
