import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink, insertClearanceRequest } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";
import { buildClearanceRequestEmail } from "@/lib/email-clearance";
import {
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
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        status: "accepted",
        acceptedAt: new Date(),
        prevAccountantEmail: noPrevAccountant ? null : (prevEmail || null),
        prevAccountantFirmName: noPrevAccountant ? null : (prevFirmName || null),
      })
    );

    const firm = getFirm(link.firmSlug || "gns");
    const services = (link.services as Array<{ id: string; name: string; price: number }> || []);
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const clearanceUrl = `${appUrl}/clearance/respond/${token}`;

    // Auto-create professional clearance DB row (nullable FKs allow this before a case exists)
    if (!noPrevAccountant && prevEmail) {
      try {
        await db.transaction((tx) =>
          insertClearanceRequest(tx, {
            prevFirmName: prevFirmName || "Previous Accountants",
            prevFirmEmail: prevEmail,
            status: "sent",
            sentAt: new Date(),
            nextChaseAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            linkToken: token,
            responseData: {
              companyName: link.companyName,
              companyNumber: link.companyNumber,
              firmSlug: link.firmSlug,
              directorName: link.directorName,
              clientEmail: link.clientEmail,
            },
          })
        );
      } catch (clearanceErr) {
        console.error("Failed to auto-create clearance request:", clearanceErr);
        // Non-fatal — email will still be sent below
      }
    }

    const emailErrors: string[] = [];

    // EMAIL 1: Professional clearance to previous accountant
    if (!noPrevAccountant && prevEmail) {
      try {
        await sendMail({
          to: prevEmail,
          toName: prevFirmName || "Previous Accountant",
          subject: `Professional Clearance Request — ${link.companyName} (${link.companyNumber ?? ""})`,
          replyTo: firm.email,
          html: buildClearanceRequestEmail({
            firm,
            clientName: link.companyName ?? "",
            companyNumber: link.companyNumber ?? "",
            directorName: link.directorName ?? "",
            prevFirmName: prevFirmName || "Previous Accountants",
            clearanceUrl,
            today,
            deadline: 14,
            docItems: [],
          }),
        });
      } catch (e) {
        emailErrors.push(`clearance: ${e instanceof Error ? e.message : String(e)}`);
        console.error("Clearance email failed:", e);
      }
    }

    // EMAIL 2: Firm notification
    try {
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
    } catch (e) {
      emailErrors.push(`firm-notify: ${e instanceof Error ? e.message : String(e)}`);
      console.error("Firm notification email failed:", e);
    }

    // EMAIL 3: Welcome confirmation to client
    const docUploadUrl = `${appUrl}/onboarding/documents/${token}`;
    try {
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
    } catch (e) {
      emailErrors.push(`welcome: ${e instanceof Error ? e.message : String(e)}`);
      console.error("Welcome email failed:", e);
    }

    if (emailErrors.length) {
      console.warn("Some emails failed (engagement still accepted):", emailErrors);
    }

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
