/**
 * Professional clearance raised on its own, with no engagement letter behind it.
 *
 * The other two routes both need something to hang off: /api/clearance/send
 * needs a case, and links/[id]/clearance-send needs an onboarding link. Both
 * mean the engagement letter has to have been issued first. In practice the
 * handover is often started the moment a client says yes — before anything has
 * been sent — and waiting simply delays the records arriving.
 *
 * Staff type the client and the outgoing accountant in by hand. The request is
 * recorded with no link token and no case, which the schema allows and the
 * auto-chaser already copes with (it falls back to the request id when building
 * the response URL), so it is tracked and chased like any other.
 *
 * As with the pre-signature route, ONLY our own clearance letter is sent. The
 * client authority letter speaks in the client's voice and carries their name
 * as a signature; there is no client record here at all, let alone a signature,
 * so issuing one would be inventing an authority that does not exist.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb, insertClearanceRequest, upsertDraftLink, updateOnboardingLink, getOnboardingLinkByToken } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { buildClearancePdf, clearancePdfFilename } from "@/lib/clearance-pdf";
import { buildClearanceItems } from "@/lib/post-acceptance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    firmSlug?: string;
    clientName?: string;
    companyNumber?: string;
    directorName?: string;
    clientEmail?: string;
    prevFirmName?: string;
    prevFirmEmail?: string;
    prevFirmAddress?: string;
    partnerName?: string;
    ccClient?: boolean;
  };

  const clientName = (body.clientName ?? "").trim();
  const prevFirmName = (body.prevFirmName ?? "").trim();
  const prevFirmEmail = (body.prevFirmEmail ?? "").trim();
  const prevFirmAddress = (body.prevFirmAddress ?? "").trim();
  const clientEmail = (body.clientEmail ?? "").trim();

  if (!clientName) {
    return NextResponse.json({ error: "The client's name is needed — it goes on the clearance letter." }, { status: 400 });
  }
  if (!prevFirmName || !prevFirmEmail) {
    return NextResponse.json(
      { error: "The previous accountant's firm name and email are both needed." },
      { status: 400 },
    );
  }
  if (body.ccClient && !clientEmail) {
    return NextResponse.json(
      { error: "To copy the client in, their email address is needed." },
      { status: 400 },
    );
  }

  const firm = getFirm(body.firmSlug || "gns");
  const now = new Date();
  const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const db = getDb();

  /* SAVE THE COMPANY, DON'T STRAND IT IN A JSON BLOB.
     The details looked up on Companies House are the same ones the engagement
     letter needs. Recording them only inside the clearance request would mean
     re-entering them later and leaving the clearance orphaned from the client
     it belongs to. So a DRAFT onboarding link is created to hold them: it sends
     nothing by itself, it is what the wizard already resumes from
     (/onboarding/services?draft=<token>), and it gives the clearance a link
     token — so this request shows on that client's profile and the engagement
     letter continues from here instead of starting again. */
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  try {
    await db.transaction((tx) =>
      upsertDraftLink(tx, {
        token,
        firmSlug: firm.slug,
        companyName: clientName,
        companyNumber: body.companyNumber?.trim() || null,
        directorName: body.directorName?.trim() || null,
        directorEmail: clientEmail || null,
        // NOT NULL on the column; blank until the engagement letter needs it.
        clientEmail: clientEmail || "",
        services: [],
        sentAt: now,
        expiresAt,
        prevAccountantFirmName: prevFirmName,
        prevAccountantEmail: prevFirmEmail,
        letterMeta: {
          // Marks where this client came from, and pre-fills the wizard.
          startedFrom: "clearance-first",
          wizardDraft: { step: "services", clientType: "limited" },
        },
      }),
    );
  } catch (e) {
    console.error("standalone clearance: could not save the company draft:", e);
    return NextResponse.json({ error: "Could not save the company record." }, { status: 500 });
  }

  // Recorded next, so the request exists to chase even if the send fails.
  try {
    await db.transaction((tx) =>
      insertClearanceRequest(tx, {
        prevFirmName,
        prevFirmEmail,
        prevFirmAddress: prevFirmAddress || null,
        status: "sent",
        sentAt: now,
        nextChaseAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        // Ties the request to the saved company above.
        linkToken: token,
        responseData: {
          companyName: clientName,
          companyNumber: body.companyNumber?.trim() || null,
          firmSlug: firm.slug,
          directorName: body.directorName?.trim() || null,
          clientEmail: clientEmail || null,
          docItems: buildClearanceItems([]),
          raisedByStaff: session.displayName ?? session.userId,
          raisedWithoutClientAuthority: true,
          raisedBeforeEngagementLetter: true,
        },
      }),
    );
  } catch (e) {
    console.error("standalone clearance: could not record the request:", e);
    return NextResponse.json({ error: "Could not record the clearance request." }, { status: 500 });
  }

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  try {
    const pdf = await buildClearancePdf({
      firm,
      clientName,
      companyNumber: body.companyNumber?.trim() || undefined,
      directorName: body.directorName?.trim() || undefined,
      prevFirmName,
      prevFirmAddress: prevFirmAddress || undefined,
      partnerName: body.partnerName?.trim() || undefined,
      today,
    });
    attachments.push({
      filename: clearancePdfFilename(clientName),
      content: pdf,
      contentType: "application/pdf",
    });
  } catch (e) {
    console.error("standalone clearance: PDF failed, sending without it:", e);
  }

  try {
    const r = await sendTemplatedMail({
      key: "prev_clearance_request",
      firm,
      to: prevFirmEmail,
      toName: prevFirmName,
      replyTo: firm.email,
      attachments,
      cc: body.ccClient ? clientEmail : undefined,
      noGlobalCc: true,
      vars: {
        companyName: clientName,
        companyNumber: body.companyNumber?.trim() ?? "",
        directorName: body.directorName?.trim() ?? "",
        prevFirmName,
        today,
      },
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `Clearance was recorded, but the email to ${prevFirmEmail} failed: ${r.error ?? "send failed"}` },
        { status: 502 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Clearance was recorded, but the email failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  /* Stamp the saved company so that if this client later signs an engagement
     letter, the outgoing firm is not emailed a clearance request a second time
     — the acceptance flow skips clearance when it finds this. */
  try {
    const saved = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
    if (saved) {
      const acc = (saved.acceptanceData ?? {}) as Record<string, unknown>;
      await db.transaction((tx) =>
        updateOnboardingLink(tx, saved.id, {
          acceptanceData: {
            ...acc,
            ...(prevFirmAddress ? { prevFirmAddress } : {}),
            clearanceSentAt: now.toISOString(),
            clearanceSentBy: session.displayName ?? session.userId,
            clearanceSentWithoutClientAuthority: true,
          },
        }),
      );
    }
  } catch (e) {
    console.error("standalone clearance: could not stamp the saved company:", e);
  }

  return NextResponse.json({
    success: true,
    sentTo: prevFirmEmail,
    attachedClearanceLetter: attachments.length > 0,
    // So the UI can offer to carry straight on into the engagement letter.
    token,
    continueUrl: `/onboarding/services?draft=${token}`,
    clientUrl: `/staff/clients/${token}`,
  });
}
