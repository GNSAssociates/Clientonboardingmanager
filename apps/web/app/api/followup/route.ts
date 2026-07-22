import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, incrementFollowUp } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";
import { buildClientFollowUpEmail, buildPrevAccountantFollowUpEmail } from "@/lib/email-constants";

export async function POST(req: NextRequest) {
  try {
    const { token, type } = await req.json() as { token: string; type: "client" | "clearance" };

    if (!token || !type) {
      return NextResponse.json({ error: "token and type required" }, { status: 400 });
    }

    const db = getDb();
    const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const firm = getFirm(link.firmSlug || "gns");
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (type === "client") {
      if (link.status === "accepted") {
        return NextResponse.json({ error: "Client has already signed" }, { status: 409 });
      }

      const followUpNum = (link.clientFollowUpCount ?? 0) + 1;
      const engagementUrl = `${appUrl}/onboarding/engage/${token}`;
      const expiresAt = new Date(link.expiresAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });

      await sendMail({
        to: link.clientEmail,
        toName: link.directorName || undefined,
        subject: `Reminder ${followUpNum}: Please sign your engagement letter — ${link.companyName}`,
        replyTo: firm.email,
        html: buildClientFollowUpEmail({
          firm,
          companyName: link.companyName ?? "",
          directorName: link.directorName ?? "",
          engagementUrl,
          expiresAt,
          followUpNumber: followUpNum,
          today,
        }),
      });

      await db.transaction((tx) => incrementFollowUp(tx, link.id, "client"));

      return NextResponse.json({ success: true, followUpNumber: followUpNum });
    }

    if (type === "clearance") {
      if (!link.prevAccountantEmail) {
        return NextResponse.json({ error: "No previous accountant email on record" }, { status: 400 });
      }

      const followUpNum = (link.prevAccountantFollowUpCount ?? 0) + 1;
      const clearanceUrl = `${appUrl}/clearance/respond/${token}`;
      const requestedAt = link.acceptedAt
        ? new Date(link.acceptedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : today;

      await sendMail({
        to: link.prevAccountantEmail,
        toName: link.prevAccountantFirmName || "Previous Accountant",
        subject: `Follow-Up ${followUpNum}: Professional Clearance — ${link.companyName} (${link.companyNumber ?? ""})`,
        replyTo: firm.email,
        html: buildPrevAccountantFollowUpEmail({
          firm,
          prevFirmName: link.prevAccountantFirmName || "Previous Accountants",
          companyName: link.companyName ?? "",
          companyNumber: link.companyNumber ?? "",
          clearanceUrl,
          followUpNumber: followUpNum,
          requestedAt,
          today,
        }),
      });

      await db.transaction((tx) => incrementFollowUp(tx, link.id, "prevAccountant"));

      return NextResponse.json({ success: true, followUpNumber: followUpNum });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err) {
    console.error("Follow-up error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
