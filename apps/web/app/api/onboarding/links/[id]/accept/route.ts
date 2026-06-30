import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";
import {
  buildProfessionalClearanceEmail,
  buildFirmNewClientEmail,
  buildClientWelcomeEmail,
} from "@/lib/email-constants";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = params.id;
  const body = await req.json();

  const {
    prevFirmName,
    prevEmail,
    prevPhone,
    noPrevAccountant,
    docsAcknowledged,
    authorised,
    bankAccountName,
    bankAccountNumber,
    bankSortCode,
  } = body;

  if (!authorised) {
    return NextResponse.json({ error: "Declaration not accepted" }, { status: 400 });
  }

  try {
    const db = getDb();

    const link = await db.transaction((tx) =>
      getOnboardingLinkByToken(tx, token)
    );

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (new Date(link.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Link has expired" }, { status: 410 });
    }

    if (link.status === "accepted") {
      return NextResponse.json({ error: "Already accepted" }, { status: 409 });
    }

    // Save acceptance + prev accountant details for follow-up
    let caseId: string | undefined;
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        status: "accepted",
        acceptedAt: new Date(),
        prevAccountantEmail: noPrevAccountant ? null : (prevEmail || null),
        prevAccountantFirmName: noPrevAccountant ? null : (prevFirmName || null),
      })
    );

    // Auto-create professional clearance request if previous accountant provided
    if (!noPrevAccountant && prevEmail && prevFirmName) {
      const nextChaseAt = new Date();
      nextChaseAt.setDate(nextChaseAt.getDate() + 7); // First chase in 7 days

      try {
        const clearanceResult = await db.execute(sql.raw(`
          INSERT INTO professional_clearance_requests (
            id, case_id, entity_id, prev_firm_name, prev_firm_email, status,
            sent_at, next_chase_at, response_data, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(),
            ${link.id},
            ${link.entityId ? `'${link.entityId}'::uuid` : 'NULL'},
            '${prevFirmName}',
            '${prevEmail}',
            'sent',
            NOW(),
            '${nextChaseAt.toISOString()}',
            '{"docItems":[{"id":"1","type":"CT","label":"Corporation Tax","year":"2025/26","status":"pending","receivedDate":null,"notes":""},{"id":"2","type":"AA","label":"Accounts & Annual Return","year":"2025/26","status":"pending","receivedDate":null,"notes":""},{"id":"3","type":"PAYE","label":"PAYE Returns","year":"2025/26","status":"pending","receivedDate":null,"notes":""},{"id":"4","type":"VAT","label":"VAT Returns","year":"2025/26","status":"pending","receivedDate":null,"notes":""},{"id":"5","type":"SA","label":"Self Assessment","year":"2025/26","status":"pending","receivedDate":null,"notes":""},{"id":"6","type":"CIS","label":"CIS Returns","year":"2025/26","status":"pending","receivedDate":null,"notes":""},{"id":"7","type":"PAYROLL","label":"Payroll Records","year":"2025/26","status":"pending","receivedDate":null,"notes":""},{"id":"8","type":"HMRC","label":"HMRC References","year":"2025/26","status":"pending","receivedDate":null,"notes":""},{"id":"9","type":"OTHER","label":"Other Documents","year":"2025/26","status":"pending","receivedDate":null,"notes":""}]}'::jsonb,
            NOW(),
            NOW()
          )
          RETURNING id
        `)) as unknown as Array<{ id: string }>;
        caseId = clearanceResult[0]?.id;
      } catch (clearanceErr) {
        console.error("Failed to create clearance request:", clearanceErr);
        // Non-fatal — clearance email already sent
      }
    }

    const firm = getFirm(link.firmSlug || "gns");
    const services = (link.services as Array<{ id: string; name: string; price: number }> || []);
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const clearanceUrl = `${appUrl}/clearance/respond/${token}`;

    // EMAIL 1: Professional clearance to previous accountant (full LLP format)
    if (!noPrevAccountant && prevEmail) {
      await sendMail({
        to: prevEmail,
        toName: prevFirmName || "Previous Accountant",
        subject: `Professional Clearance Request — ${link.companyName} (${link.companyNumber ?? ""})`,
        replyTo: firm.email,
        html: buildProfessionalClearanceEmail({
          firm,
          companyName: link.companyName ?? "",
          companyNumber: link.companyNumber ?? "",
          directorName: link.directorName ?? "",
          prevFirmName: prevFirmName || "Previous Accountants",
          clearanceUrl,
          today,
        }),
      });
    }

    // EMAIL 2: Firm notification
    await sendMail({
      to: firm.email,
      subject: `New Client Onboarded — ${link.companyName}`,
      html: buildFirmNewClientEmail({
        firm,
        companyName: link.companyName ?? "",
        companyNumber: link.companyNumber ?? "",
        directorName: link.directorName ?? "",
        clientEmail: link.clientEmail,
        services,
        prevFirmName: prevFirmName || undefined,
        prevEmail: prevEmail || undefined,
        noPrevAccountant: !!noPrevAccountant,
        today,
      }),
    });

    // EMAIL 3: Welcome confirmation to client — includes document upload link
    const docUploadUrl = `${appUrl}/onboarding/documents/${token}`;
    await sendMail({
      to: link.clientEmail,
      toName: link.directorName || undefined,
      subject: `Engagement Confirmed — Welcome to ${firm.legalName}`,
      replyTo: firm.email,
      html: buildClientWelcomeEmail({
        firm,
        companyName: link.companyName ?? "",
        directorName: link.directorName ?? "",
        services,
        docUploadUrl,
        today,
      }),
    });

    return NextResponse.json({
      success: true,
      message: !noPrevAccountant
        ? "Engagement confirmed. Previous accountant notified and firm alerted."
        : "Engagement confirmed. Welcome to the firm.",
    });
  } catch (error) {
    console.error("Error accepting engagement:", error);
    return NextResponse.json({ error: "Failed to accept engagement" }, { status: 500 });
  }
}
