import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkById, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { sendTemplatedMail } from "@/lib/send-templated-mail";

export const dynamic = "force-dynamic";

/**
 * Reminder = resend the engagement letter to the client so they can review and
 * sign it (not just a nudge). The client sees the full letter and, once they
 * sign, the engagement is completed.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();

    // The [id] segment is a TOKEN nearly everywhere in this API (the client
    // profile, the engage page, the document portal all pass the token), but this
    // route looked the link up by database id only. Passing a 64-char token to a
    // uuid column throws, which surfaced as "Failed to resend link" whenever the
    // button was pressed from a client's profile. Accept either.
    const resolveLink = async () => {
      const byToken = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id)).catch(() => null);
      if (byToken) return byToken;
      // Only try the id lookup when it actually looks like a uuid, so a token can
      // never reach the uuid column and blow up the request.
      const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
      if (!looksLikeUuid) return null;
      return db.transaction((tx) => getOnboardingLinkById(tx, params.id)).catch(() => null);
    };

    const link = await resolveLink();
    if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

    if (link.status === "accepted") {
      return NextResponse.json({ error: "This client has already signed" }, { status: 409 });
    }
    if (new Date(link.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Link has expired — create a new one" }, { status: 410 });
    }

    const firm = getFirm(link.firmSlug || "gns");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const engagementUrl = `${appUrl}/onboarding/engage/${link.token}`;
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const expiryStr = new Date(link.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const meta = (link.letterMeta ?? {}) as { sendMode?: string };
    const sendMode = meta.sendMode ?? "engagement";
    const resendCount = (parseInt(link.resendCount) || 0) + 1;

    // Re-send the same (editable) template that matches how this link was issued.
    const templateKey =
      sendMode === "details_only" ? "client_details_request"
      : sendMode === "proposal" || sendMode === "proposal_only" ? "client_proposal"
      : "client_engagement";

    let emailSent = false;
    try {
      const r = await sendTemplatedMail({
        key: templateKey,
        firm,
        token: link.token,
        to: link.clientEmail,
        toName: link.directorName || undefined,
        replyTo: firm.email,
        actionUrl: engagementUrl,
        vars: {
          directorName: link.directorName || "Director",
          companyName: link.companyName ?? "",
          companyNumber: link.companyNumber ?? "",
          expiresAt: expiryStr,
          today,
        },
      });
      emailSent = r.ok;
    } catch (e) {
      console.error("Reminder email failed:", e);
    }

    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, { resendCount: resendCount.toString(), lastResentAt: new Date() })
    );

    return NextResponse.json({
      success: true,
      emailSent,
      mode: meta.sendMode ?? "engagement",
      message: emailSent
        ? `Engagement letter resent to ${link.clientEmail}`
        : `Reminder recorded, but email could not be sent — check SMTP settings.`,
      resendCount,
    });
  } catch (error) {
    console.error("Error resending link:", error);
    return NextResponse.json(
      {
        error: "Failed to resend link",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
