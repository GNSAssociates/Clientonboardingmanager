import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, incrementDocFollowUp } from "@gns/db";
import { sendMail } from "@/lib/mailer";
import { getFirm } from "@/lib/firms";

export const dynamic = "force-dynamic";

// Director ID (KYC) documents chased from the CLIENT every 2 days after signing.
const IDENTITY_DOC_TYPES = ["passport_photo_page", "passport_back_or_licence", "proof_of_address"];
const CHASE_INTERVAL_DAYS = 2;
const MAX_CHASES = 8;

// Called by Vercel Cron daily at 09:00 UTC. Runs every day but only emails a
// client when their last chase (or signing) was >= 2 days ago, so the cadence
// is every 2 days even on a daily schedule.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - CHASE_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

  // Pending director ID docs on accepted engagements, grouped per onboarding link
  const rows = await db.execute(sql`
    SELECT ds.onboarding_token AS token,
           json_agg(json_build_object('label', ds.doc_label, 'followUpCount', ds.follow_up_count)) AS docs,
           MAX(ds.follow_up_count) AS follow_up_count,
           MAX(ds.last_follow_up_at) AS last_follow_up_at,
           ol.client_email, ol.director_name, ol.company_name, ol.firm_slug, ol.accepted_at
    FROM document_submissions ds
    JOIN onboarding_links ol ON ol.token = ds.onboarding_token
    WHERE ds.status = 'pending'
      AND ds.doc_type IN ('passport_photo_page', 'passport_back_or_licence', 'proof_of_address')
      AND ol.status = 'accepted'
    GROUP BY ds.onboarding_token, ol.client_email, ol.director_name, ol.company_name, ol.firm_slug, ol.accepted_at
  `) as unknown as Array<{
    token: string;
    docs: Array<{ label: string; followUpCount: number }>;
    follow_up_count: number | null;
    last_follow_up_at: string | null;
    client_email: string;
    director_name: string | null;
    company_name: string | null;
    firm_slug: string | null;
    accepted_at: string | null;
  }>;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let chased = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const chaseCount = row.follow_up_count ?? 0;
      if (chaseCount >= MAX_CHASES) { skipped++; continue; }

      // Anchor the 2-day cadence on the last chase, or the signing date for the first one
      const anchor = row.last_follow_up_at
        ? new Date(row.last_follow_up_at)
        : row.accepted_at ? new Date(row.accepted_at) : null;
      if (anchor && anchor > cutoff) { skipped++; continue; }

      const firm = getFirm(row.firm_slug || "gns");
      const uploadUrl = `${appUrl}/onboarding/documents/${row.token}`;
      const chaseNumber = chaseCount + 1;
      const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const docLabels = [...new Set((row.docs ?? []).map((d) => d.label))];

      const docRows = docLabels.map((label) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #fef3c7;font-size:13px;color:#374151;font-weight:600">${label}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #fef3c7;font-size:12px;color:#d97706;font-weight:600">Outstanding</td>
        </tr>`).join("");

      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td height="5" style="background:linear-gradient(90deg,${firm.accentColor},#1e3a8a);font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:32px 36px">
    <img src="${appUrl}${firm.logo}" alt="${firm.name}" height="52" style="display:block;margin-bottom:16px">
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#111">${firm.legalName}</p>
    <p style="margin:0 0 20px;font-size:12px;color:#9ca3af">${today}</p>
    <div style="height:1px;background:#e5e7eb;margin-bottom:20px"></div>

    <p style="margin:0 0 14px;font-size:14px;color:#374151">Dear ${row.director_name || "Director"},</p>
    <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7">
      Thank you for signing your engagement letter for <strong>${row.company_name ?? "your company"}</strong>.
      To complete your anti-money-laundering (KYC) checks, we still need the following ID document${docLabels.length !== 1 ? "s" : ""} from you:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fcd34d;border-radius:8px;overflow:hidden;margin:0 0 20px">
      <thead><tr style="background:#fffbeb">
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#92400e;font-weight:600">Document</th>
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#92400e;font-weight:600">Status</th>
      </tr></thead>
      <tbody>${docRows}</tbody>
    </table>

    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">
      Uploading takes less than 2 minutes — a photo taken on your phone is fine.
    </p>

    <div style="text-align:center;margin:24px 0">
      <a href="${uploadUrl}" style="display:inline-block;background:${firm.accentColor};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px">
        Upload Documents Now
      </a>
    </div>

    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;line-height:1.6">
      Reminder ${chaseNumber} — we'll continue to follow up every ${CHASE_INTERVAL_DAYS} days until these are received.
      If you have already sent them by another route, please reply to this email and we'll update our records.
    </p>

    <p style="margin:24px 0 0;font-size:14px;color:#374151">
      Kind regards,<br>
      <strong>${firm.name}</strong><br>
      <span style="color:#6b7280;font-size:13px">${firm.phone} · ${firm.email}</span>
    </p>
  </td></tr>
  <tr><td style="padding:16px 36px 24px;background:#f8f9fb;border-top:1px solid #e8eaed">
    <p style="margin:0;font-size:11px;color:#9ca3af">${firm.legalName} · ${firm.address}, ${firm.city}, ${firm.postcode} · ${firm.regStatement}</p>
  </td></tr>
</table></td></tr></table></body></html>`;

      await sendMail({
        to: row.client_email,
        toName: row.director_name || undefined,
        subject: `Reminder ${chaseNumber}: ID documents needed — ${row.company_name ?? ""}`,
        replyTo: firm.email,
        html,
      });

      await db.transaction((tx) => incrementDocFollowUp(tx, row.token));
      chased++;
    } catch (err) {
      errors.push(`${row.token}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({ candidates: rows.length, chased, skipped, errors });
}
