import { NextRequest, NextResponse } from "next/server";
import { getDb, updateClearanceRequest, insertClearanceFollowup } from "@gns/db";
import { sendMail } from "@/lib/mailer";
import { getFirmByEntityId } from "@/lib/firms";
import { buildClearanceChaseEmail } from "@/lib/email-clearance";
import type { DocItem } from "@/app/(staff)/staff/cases/[id]/clearance/_tracker";

// Called by Vercel Cron or a scheduled job — processes all overdue clearance requests
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  // Find all requests due for a chase
  const dueRows = await db.execute(
    `SELECT * FROM professional_clearance_requests
     WHERE status IN ('sent', 'chased')
     AND next_chase_at <= $1
     AND outcome IS NULL`,
    [now.toISOString()]
  ) as { rows: Array<{
    id: string; entity_id: string; case_id: string;
    prev_firm_name: string; prev_firm_email: string | null;
    response_data: unknown;
  }> };

  let chased = 0;
  const errors: string[] = [];

  for (const row of dueRows.rows) {
    try {
      const rd = (row.response_data ?? {}) as { docItems?: DocItem[] };
      const outstanding = (rd.docItems ?? []).filter(i => i.status === "pending");
      if (outstanding.length === 0 || !row.prev_firm_email) continue;

      const firm = getFirmByEntityId(row.entity_id);

      const countRows = await db.execute(
        `SELECT COUNT(*)::int as cnt FROM clearance_followups WHERE request_id = $1`,
        [row.id]
      ) as { rows: Array<{ cnt: number }> };
      const chaseNumber = (countRows.rows[0]?.cnt ?? 0) + 1;
      const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      if (firm) {
        await sendMail({
          to: row.prev_firm_email,
          toName: row.prev_firm_name,
          subject: `[Chase ${chaseNumber}] Professional Clearance — Outstanding Documents`,
          replyTo: firm.email,
          html: buildClearanceChaseEmail({
            firm,
            prevFirmName: row.prev_firm_name,
            chaseNumber,
            outstanding,
            clearanceUrl: `${appUrl}/clearance/respond/${row.case_id}`,
            today,
          }),
        });
      }

      const nextChaseAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await db.transaction(tx =>
        Promise.all([
          updateClearanceRequest(tx, row.id, { status: "chased", nextChaseAt }),
          insertClearanceFollowup(tx, {
            requestId: row.id,
            entityId: row.entity_id,
            caseId: row.case_id,
            chaseNumber: String(chaseNumber),
            sentAt: now,
            notes: `Auto-chase: ${outstanding.length} items outstanding`,
          }),
        ])
      );
      chased++;
    } catch (err) {
      errors.push(`${row.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({ processed: dueRows.rows.length, chased, errors });
}
