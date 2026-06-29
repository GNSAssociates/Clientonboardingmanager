import { NextRequest, NextResponse } from "next/server";
import { getDb, getClearanceRequestById, updateClearanceRequest, insertClearanceFollowup } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { sendMail } from "@/lib/mailer";
import { getFirmByEntityId } from "@/lib/firms";
import { buildClearanceChaseEmail } from "@/lib/email-clearance";
import type { DocItem } from "@/app/(staff)/staff/cases/[id]/clearance/_tracker";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId, entityId } = await req.json() as { caseId: string; entityId: string };

  const db = getDb();
  const request = await db.transaction(tx => getClearanceRequestById(tx, params.id));
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!request.prevFirmEmail) {
    return NextResponse.json({ error: "No email address for previous firm" }, { status: 400 });
  }

  const rd = (request.responseData ?? {}) as { docItems?: DocItem[] };
  const outstanding = (rd.docItems ?? []).filter(i => i.status === "pending");

  if (outstanding.length === 0) {
    return NextResponse.json({ message: "All documents received — no chase needed" });
  }

  const firm = getFirmByEntityId(entityId);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Count previous followups
  const rows = await db.execute(
    `SELECT COUNT(*)::int as cnt FROM clearance_followups WHERE request_id = $1`,
    [params.id]
  ) as { rows: Array<{ cnt: number }> };
  const chaseNumber = (rows.rows[0]?.cnt ?? 0) + 1;

  const nextChaseAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  if (firm) {
    await sendMail({
      to: request.prevFirmEmail,
      toName: request.prevFirmName,
      subject: `[Chase ${chaseNumber}] Professional Clearance — Outstanding Documents`,
      replyTo: firm.email,
      html: buildClearanceChaseEmail({
        firm,
        prevFirmName: request.prevFirmName,
        chaseNumber,
        outstanding,
        clearanceUrl: `${appUrl}/clearance/respond/${caseId}`,
        today,
      }),
    });
  }

  await db.transaction(tx =>
    Promise.all([
      updateClearanceRequest(tx, params.id, {
        status: "chased",
        nextChaseAt,
      }),
      insertClearanceFollowup(tx, {
        requestId: params.id,
        entityId,
        caseId,
        chaseNumber: String(chaseNumber),
        sentAt: new Date(),
        sentBy: session.userId ?? undefined,
        notes: `${outstanding.length} items outstanding`,
      }),
    ])
  );

  return NextResponse.json({
    message: `Chase ${chaseNumber} sent — ${outstanding.length} outstanding items. Next auto-chase: ${nextChaseAt.toLocaleDateString("en-GB")}`,
  });
}
