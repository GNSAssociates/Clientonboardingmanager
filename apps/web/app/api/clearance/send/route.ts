import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, insertClearanceRequest } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { getFirmByEntityId } from "@/lib/firms";
import { buildClearanceDocx, clearanceDocFilename } from "@/lib/clearance-doc";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    caseId: string;
    entityId: string;
    clientName: string;
    companyNumber: string;
    prevFirmName: string;
    prevFirmEmail: string;
    prevFirmAddress?: string;
    responseDeadlineDays?: number;
    docItems: unknown[];
  };

  const { caseId, entityId, clientName, companyNumber, prevFirmName, prevFirmEmail, prevFirmAddress, responseDeadlineDays, docItems } = body;

  if (!prevFirmName || !prevFirmEmail) {
    return NextResponse.json({ error: "Previous firm name and email required" }, { status: 400 });
  }

  const db = getDb();
  const firm = getFirmByEntityId(entityId);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  void responseDeadlineDays;

  const nextChaseAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  // Need a clientId — fetch from case
  let clientId: string;
  try {
    const rows = await db.execute(sql`
      SELECT client_id FROM onboarding_cases WHERE id = ${caseId} LIMIT 1
    `) as unknown as Array<{ client_id: string }>;
    clientId = rows[0]?.client_id ?? caseId;
  } catch {
    clientId = caseId;
  }

  const request = await db.transaction(tx =>
    insertClearanceRequest(tx, {
      entityId,
      caseId,
      clientId,
      prevFirmName,
      prevFirmEmail,
      prevFirmAddress: prevFirmAddress || null,
      status: "sent",
      sentAt: new Date(),
      nextChaseAt,
      // Store the context the auto-chase cron needs to render its template.
      responseData: { docItems, companyName: clientName, companyNumber, firmSlug: firm?.slug },
    })
  );

  // Client email (for CC on the clearance request) — first contact on the case.
  let clientEmail: string | undefined;
  try {
    const rows = await db.execute(sql`
      SELECT email FROM client_contacts
      WHERE client_id = ${clientId} AND email IS NOT NULL
      ORDER BY created_at LIMIT 1
    `) as unknown as Array<{ email: string }>;
    clientEmail = rows[0]?.email ?? undefined;
  } catch {
    clientEmail = undefined;
  }

  // Send email with the formal clearance letter attached as a Word document.
  // No portal link — the previous accountant just replies with the records.
  if (firm) {
    void appUrl;
    let attachments;
    try {
      const buffer = await buildClearanceDocx({
        firm, clientName, companyNumber, prevFirmName, prevFirmAddress: prevFirmAddress || undefined,
        docItems, today,
      });
      attachments = [{ filename: clearanceDocFilename(clientName), content: buffer, contentType: DOCX_MIME }];
    } catch (e) {
      console.error("Clearance .docx generation failed (sending without attachment):", e);
    }
    try {
      await sendTemplatedMail({
        key: "prev_clearance_request",
        firm,
        to: prevFirmEmail,
        toName: prevFirmName,
        replyTo: firm.email,
        // Firm policy: CC the client and info@ (info@ added centrally by the
        // template CC map). No other shared inbox.
        cc: clientEmail,
        noGlobalCc: true,
        attachments,
        vars: {
          companyName: clientName,
          companyNumber,
          prevFirmName,
          today,
        },
      });
    } catch (err) {
      console.error("Clearance email failed (request still saved):", err);
    }
  }

  return NextResponse.json({ success: true, requestId: request.id });
}
