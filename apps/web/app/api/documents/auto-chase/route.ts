import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, incrementDocFollowUp } from "@gns/db";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { dispatchDueScheduledSends } from "@/lib/scheduled-send";
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
      AND (ol.acceptance_data->>'stopClientChase') IS DISTINCT FROM 'true'
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
      const outstandingList = docLabels.length
        ? `<ul style="margin:8px 0 14px;padding-left:20px">${docLabels.map((l) => `<li style="margin:2px 0">${l}</li>`).join("")}</ul>`
        : "";

      await sendTemplatedMail({
        key: "client_doc_reminder",
        firm,
        token: row.token,
        to: row.client_email,
        toName: row.director_name || undefined,
        replyTo: firm.email,
        actionUrl: uploadUrl,
        vars: {
          directorName: row.director_name || "Director",
          companyName: row.company_name ?? "",
          followUpNumber: chaseNumber,
          today,
          outstandingList,
        },
      });

      await db.transaction((tx) => incrementDocFollowUp(tx, row.token));
      chased++;
    } catch (err) {
      errors.push(`${row.token}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // Also flush any onboarding emails whose scheduled send time has arrived.
  // Piggy-backing here means scheduled sends work on any Vercel plan without a
  // third cron job. For to-the-hour precision, add a dedicated hourly cron on
  // /api/onboarding/scheduled-send (requires the Vercel Pro plan).
  let scheduled: Awaited<ReturnType<typeof dispatchDueScheduledSends>> | null = null;
  try {
    scheduled = await dispatchDueScheduledSends();
  } catch (e) {
    errors.push(`scheduled-send: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ candidates: rows.length, chased, skipped, errors, scheduled });
}
