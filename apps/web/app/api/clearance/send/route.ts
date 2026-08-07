import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, insertClearanceRequest } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { getFirmByEntityId } from "@/lib/firms";
import { buildClearancePdf, clearancePdfFilename } from "@/lib/clearance-pdf";
import { buildAuthorityLetterPdf, authorityLetterFilename } from "@/lib/authority-letter-pdf";

const PDF_MIME = "application/pdf";

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

  // The clearance letter is signed by the partner who issued this client's
  // engagement letter, so both documents come from the same named partner.
  // Falls back to the firm's default partner when no engagement is on file.
  let actingPartner: string | undefined;
  let engagementDirector: string | undefined;
  // The authority letter is plain-paper with the CLIENT as sender, so it needs
  // their own address for the letterhead block.
  let engagementClientAddress: string | undefined;
  try {
    const rows = (await db.execute(sql`
      SELECT letter_meta->>'partnerName'   AS partner_name,
             letter_meta->>'clientAddress' AS client_address,
             director_name
      FROM onboarding_links
      WHERE client_id = ${clientId}
      ORDER BY created_at DESC
      LIMIT 1
    `)) as unknown as Array<{ partner_name: string | null; client_address: string | null; director_name: string | null }>;
    actingPartner = rows[0]?.partner_name ?? undefined;
    engagementDirector = rows[0]?.director_name ?? undefined;
    engagementClientAddress = rows[0]?.client_address ?? undefined;
  } catch {
    actingPartner = undefined;
  }

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
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    // 1) Professional clearance letter (from GNS to the outgoing accountant).
    try {
      const buffer = await buildClearancePdf({
        firm, clientName, companyNumber, prevFirmName, prevFirmAddress: prevFirmAddress || undefined,
        directorName: engagementDirector, partnerName: actingPartner, docItems, today,
      });
      attachments.push({ filename: clearancePdfFilename(clientName), content: buffer, contentType: PDF_MIME });
    } catch (e) {
      console.error("Clearance PDF generation failed (sending without attachment):", e);
    }
    // 2) Client authority (change of accountants) letter — the client's written
    // authority for the outgoing accountant to release records to us. Sent with
    // the first clearance email so the outgoing firm has the authority in hand.
    try {
      const authBuffer = await buildAuthorityLetterPdf({
        firm, clientName, companyNumber, directorName: engagementDirector,
        clientAddress: engagementClientAddress,
        prevFirmName, prevFirmAddress: prevFirmAddress || undefined, today,
      });
      attachments.push({ filename: authorityLetterFilename(clientName), content: authBuffer, contentType: PDF_MIME });
    } catch (e) {
      console.error("Authority letter generation failed (sending without it):", e);
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
