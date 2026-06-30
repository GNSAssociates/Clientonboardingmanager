import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, insertClearanceRequest } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { sendMail } from "@/lib/mailer";
import { getFirmByEntityId } from "@/lib/firms";
import { buildClearanceRequestEmail } from "@/lib/email-clearance";

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
  const deadline = responseDeadlineDays ?? 14;

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
      responseData: { docItems },
    })
  );

  // Send email
  if (firm) {
    const clearanceUrl = `${appUrl}/clearance/respond/${caseId}`;
    try {
      await sendMail({
        to: prevFirmEmail,
        toName: prevFirmName,
        subject: `Professional Clearance Request — ${clientName}${companyNumber ? ` (${companyNumber})` : ""}`,
        replyTo: firm.email,
        html: buildClearanceRequestEmail({
          firm,
          clientName,
          companyNumber,
          prevFirmName,
          prevFirmAddress,
          clearanceUrl,
          today,
          deadline,
          docItems: docItems as Array<{ label: string; year: string; type: string }>,
        }),
      });
    } catch (err) {
      console.error("Clearance email failed (request still saved):", err);
    }
  }

  return NextResponse.json({ success: true, requestId: request.id });
}
