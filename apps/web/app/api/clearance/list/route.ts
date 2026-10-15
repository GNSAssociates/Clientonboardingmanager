import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@gns/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/* STAFF ONLY.
 *
 * This answered anyone on the internet with up to 200 rows of client name,
 * company number, previous accountant — and link_token, which IS the credential
 * that protects the signing page, the document portal and the Direct Debit
 * flow. Anyone who called it could sign engagements as those clients.
 *
 * The token is not returned at all now: the screens never used it (it is only
 * read server-side, in the chase route), so there is no reason for it to leave
 * the server. */
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const rows = await db.execute(sql.raw(`
      SELECT
        pcr.id,
        pcr.case_id         AS "caseId",
        pcr.prev_firm_name  AS "prevFirmName",
        pcr.prev_firm_email AS "prevFirmEmail",
        pcr.status,
        pcr.sent_at         AS "sentAt",
        pcr.next_chase_at   AS "nextChaseAt",
        pcr.response_data   AS "responseData",
        c.name              AS "clientName",
        COALESCE(c.company_number, ol.company_number) AS "companyNumber",
        (
          SELECT COUNT(*)::int
          FROM clearance_followups cf
          WHERE cf.request_id = pcr.id
        ) AS "chaseCount"
      FROM professional_clearance_requests pcr
      LEFT JOIN onboarding_cases oc ON oc.id = pcr.case_id
      LEFT JOIN clients c ON c.id = oc.client_id
      LEFT JOIN onboarding_links ol ON ol.token = pcr.link_token
      WHERE pcr.outcome IS NULL OR pcr.outcome IN ('clear', 'issues_raised')
      ORDER BY pcr.sent_at DESC NULLS LAST
      LIMIT 200
    `)) as unknown as Array<{
      id: string;
      caseId: string | null;
      prevFirmName: string;
      prevFirmEmail: string | null;
      status: string;
      sentAt: string | null;
      nextChaseAt: string | null;
      responseData: unknown;
      clientName: string | null;
      companyNumber: string | null;
      chaseCount: number;
    }>;

    const result = rows.map(r => {
      const rd = (r.responseData ?? {}) as {
        docItems?: Array<{ status: string }>;
        firmSlug?: string;
        companyName?: string;
        companyNumber?: string;
      };
      const items = rd.docItems ?? [];
      return {
        id: r.id,
        caseId: r.caseId,
        prevFirmName: r.prevFirmName,
        prevFirmEmail: r.prevFirmEmail,
        status: r.status,
        sentAt: r.sentAt,
        nextChaseAt: r.nextChaseAt,
        clientName: r.clientName ?? rd.companyName ?? null,
        companyNumber: r.companyNumber ?? rd.companyNumber ?? null,
        chaseCount: r.chaseCount,
        pendingItems: items.filter(i => i.status === 'pending').length,
        receivedItems: items.filter(i => i.status === 'received').length,
        firmSlug: rd.firmSlug ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to list clearance requests:", err);
    return NextResponse.json([], { status: 200 });
  }
}
