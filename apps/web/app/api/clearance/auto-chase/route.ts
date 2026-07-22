import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, updateClearanceRequest, insertClearanceFollowup } from "@gns/db";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { getFirm, getFirmByEntityId } from "@/lib/firms";
import type { DocItem } from "@/app/(staff)/staff/cases/[id]/clearance/_tracker";

// Build a simple bulleted HTML list of document names (or a fallback line).
function docListHtml(items: DocItem[]): string {
  if (!items.length) return "<p style=\"margin:8px 0 14px\">(no items listed)</p>";
  const rows = items.map((i) => `<li style="margin:2px 0">${i.label || "Document"}</li>`).join("");
  return `<ul style="margin:8px 0 14px;padding-left:20px">${rows}</ul>`;
}

// Called by Vercel Cron daily at 10:00 UTC — processes all overdue clearance requests.
// Vercel automatically sends Authorization: Bearer {CRON_SECRET} on every cron invocation.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  // Find all requests due for a chase
  const dueRows = await db.execute(sql`
    SELECT id, entity_id, case_id, link_token,
           prev_firm_name, prev_firm_email, response_data
    FROM professional_clearance_requests
    WHERE status IN ('sent', 'chased')
    AND next_chase_at <= ${now.toISOString()}
    AND outcome IS NULL
    AND (response_data->>'stopChase') IS DISTINCT FROM 'true'
  `) as unknown as Array<{
    id: string; entity_id: string | null; case_id: string | null;
    link_token: string | null;
    prev_firm_name: string; prev_firm_email: string | null;
    response_data: unknown;
  }>;

  let chased = 0;
  const errors: string[] = [];

  for (const row of dueRows) {
    try {
      const rd = (row.response_data ?? {}) as {
        docItems?: DocItem[];
        firmSlug?: string;
        companyName?: string;
        companyNumber?: string;
      };
      const outstanding = (rd.docItems ?? []).filter(i => i.status === "pending");
      const received = (rd.docItems ?? []).filter(i => i.status === "received");
      if (!row.prev_firm_email) continue;

      const firm = rd.firmSlug ? getFirm(rd.firmSlug) : getFirmByEntityId(row.entity_id ?? "");

      const countRows = await db.execute(sql`
        SELECT COUNT(*)::int as cnt FROM clearance_followups WHERE request_id = ${row.id}
      `) as unknown as Array<{ cnt: number }>;
      const chaseNumber = (countRows[0]?.cnt ?? 0) + 1;
      const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      // Use case_id if available, fall back to link_token-based URL
      const respondUrl = row.case_id
        ? `${appUrl}/clearance/respond/${row.case_id}`
        : `${appUrl}/clearance/respond/link/${row.link_token ?? row.id}`;

      if (firm) {
        const receivedNote = received.length
          ? `<p style="margin:6px 0 0;color:#6b7280;font-size:13px">For reference, we have already received: ${received.map((i) => i.label).filter(Boolean).join(", ")}.</p>`
          : "";
        await sendTemplatedMail({
          key: "prev_clearance_chase",
          firm,
          token: row.link_token ?? undefined,
          to: row.prev_firm_email,
          toName: row.prev_firm_name,
          replyTo: firm.email,
          actionUrl: respondUrl,
          // Clearance correspondence must not be CC'd to the firm's shared inbox.
          noGlobalCc: true,
          vars: {
            prevFirmName: row.prev_firm_name,
            companyName: rd.companyName ?? "",
            companyNumber: rd.companyNumber ?? "",
            followUpNumber: chaseNumber,
            today,
            outstandingList: docListHtml(outstanding),
            receivedNote,
          },
        });
      }

      const nextChaseAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await db.transaction(tx =>
        Promise.all([
          updateClearanceRequest(tx, row.id, { status: "chased", nextChaseAt }),
          ...(row.entity_id && row.case_id ? [
            insertClearanceFollowup(tx, {
              requestId: row.id,
              entityId: row.entity_id,
              caseId: row.case_id,
              chaseNumber: String(chaseNumber),
              sentAt: now,
              notes: `Auto-chase: ${outstanding.length} items outstanding`,
            }),
          ] : []),
        ])
      );
      chased++;
    } catch (err) {
      errors.push(`${row.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({ processed: dueRows.length, chased, errors });
}
