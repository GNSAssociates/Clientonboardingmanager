import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, getClearanceRequestById, updateClearanceRequest, insertClearanceFollowup } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { getFirm, getFirmByEntityId } from "@/lib/firms";
import type { DocItem } from "@/app/(staff)/staff/cases/[id]/clearance/_tracker";

function docListHtml(items: DocItem[]): string {
  if (!items.length) return "<p style=\"margin:8px 0 14px\">(no items listed)</p>";
  const rows = items.map((i) => `<li style="margin:2px 0">${i.label || "Document"}</li>`).join("");
  return `<ul style="margin:8px 0 14px;padding-left:20px">${rows}</ul>`;
}

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
  const received = (rd.docItems ?? []).filter(i => i.status === "received");

  if (outstanding.length === 0) {
    return NextResponse.json({ message: "All documents received — no chase needed" });
  }

  const rdMeta = rd as { firmSlug?: string; companyName?: string; companyNumber?: string };
  const firm = rdMeta.firmSlug ? getFirm(rdMeta.firmSlug) : getFirmByEntityId(entityId);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Count previous followups
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM clearance_followups WHERE request_id = ${params.id}
  `) as unknown as Array<{ cnt: number }>;
  const chaseNumber = (rows[0]?.cnt ?? 0) + 1;

  const nextChaseAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  if (firm) {
    const receivedNote = received.length
      ? `<p style="margin:6px 0 0;color:#6b7280;font-size:13px">For reference, we have already received: ${received.map((i) => i.label).filter(Boolean).join(", ")}.</p>`
      : "";
    await sendTemplatedMail({
      key: "prev_clearance_chase",
      firm,
      token: request.linkToken ?? undefined,
      to: request.prevFirmEmail,
      toName: request.prevFirmName,
      replyTo: firm.email,
      actionUrl: `${appUrl}/clearance/respond/${caseId}`,
      // Clearance correspondence must not be CC'd to the firm's shared inbox.
      noGlobalCc: true,
      vars: {
        prevFirmName: request.prevFirmName,
        companyName: rdMeta.companyName ?? "",
        companyNumber: rdMeta.companyNumber ?? "",
        followUpNumber: chaseNumber,
        today,
        outstandingList: docListHtml(outstanding),
        receivedNote,
      },
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
