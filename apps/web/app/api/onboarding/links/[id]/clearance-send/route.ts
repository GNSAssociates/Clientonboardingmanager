/**
 * Staff-initiated professional clearance, raised BEFORE (or without) the client
 * signing anything.
 *
 * Common in practice: the client has told us verbally to go ahead, and waiting
 * for the engagement letter to come back signed just delays the handover. The
 * existing /api/clearance/send does this, but only from the cases screen — this
 * is the same thing for an onboarding link.
 *
 * WHAT IT DELIBERATELY DOES NOT SEND: the client authority letter. That document
 * is written in the client's voice and carries their name as a signature, so
 * issuing it when they have not authorised anything would put a signature in
 * front of the outgoing firm that the client never gave. Only our own clearance
 * letter goes, which is ours to send and says plainly that we have been
 * appointed. If the client signs later, the authority letter follows then.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink, insertClearanceRequest } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { buildClearancePdf, clearancePdfFilename } from "@/lib/clearance-pdf";
import { buildClearanceItems } from "@/lib/post-acceptance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = params.id;
  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const body = await req.json().catch(() => ({})) as {
    prevFirmName?: string; prevFirmEmail?: string; prevFirmAddress?: string;
    ccClient?: boolean;
  };

  // Fall back to whatever we already hold for this client.
  const prevFirmName = (body.prevFirmName ?? link.prevAccountantFirmName ?? "").trim();
  const prevFirmEmail = (body.prevFirmEmail ?? link.prevAccountantEmail ?? "").trim();
  const prevFirmAddress = (body.prevFirmAddress ?? (acc.prevFirmAddress as string) ?? "").trim();

  if (!prevFirmName || !prevFirmEmail) {
    return NextResponse.json(
      { error: "The previous accountant's firm name and email are both needed to request clearance." },
      { status: 400 },
    );
  }

  if (acc.clearanceSentAt) {
    return NextResponse.json(
      { error: `Clearance was already requested for this client on ${new Date(acc.clearanceSentAt as string).toLocaleDateString("en-GB")}.` },
      { status: 409 },
    );
  }

  const firm = getFirm(link.firmSlug || "gns");
  const meta = (link.letterMeta ?? {}) as { partnerName?: string };
  const now = new Date();
  const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const docItems = buildClearanceItems([]);

  // Tracked first, so the record exists even if the send fails and staff retry.
  try {
    await db.transaction((tx) =>
      insertClearanceRequest(tx, {
        prevFirmName,
        prevFirmEmail,
        status: "sent",
        sentAt: now,
        nextChaseAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        linkToken: token,
        responseData: {
          companyName: link.companyName,
          companyNumber: link.companyNumber,
          firmSlug: link.firmSlug,
          directorName: link.directorName,
          clientEmail: link.clientEmail,
          docItems,
          // Recorded because this clearance rests on our instruction, not on a
          // signed client authority — worth being able to tell apart later.
          raisedByStaff: session.displayName ?? session.userId,
          raisedWithoutClientAuthority: true,
        },
      }),
    );
  } catch (e) {
    console.error("clearance-send: could not record the request:", e);
    return NextResponse.json({ error: "Could not record the clearance request." }, { status: 500 });
  }

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  try {
    const pdf = await buildClearancePdf({
      firm,
      clientName: link.companyName ?? "",
      companyNumber: link.companyNumber ?? undefined,
      directorName: link.directorName ?? undefined,
      prevFirmName,
      prevFirmAddress: prevFirmAddress || undefined,
      partnerName: meta.partnerName,
      today,
    });
    attachments.push({
      filename: clearancePdfFilename(link.companyName ?? "Client"),
      content: pdf,
      contentType: "application/pdf",
    });
  } catch (e) {
    console.error("clearance-send: PDF failed, sending without it:", e);
  }

  let emailed = true;
  let emailError: string | null = null;
  try {
    const r = await sendTemplatedMail({
      key: "prev_clearance_request",
      firm,
      token,
      to: prevFirmEmail,
      toName: prevFirmName,
      replyTo: firm.email,
      attachments,
      // Default OFF here, unlike the post-signature path: the client has not
      // signed, so copying them into a letter announcing their handover should
      // be a deliberate choice rather than something staff discover afterwards.
      cc: body.ccClient ? (link.clientEmail || undefined) : undefined,
      noGlobalCc: true,
      vars: {
        companyName: link.companyName ?? "",
        companyNumber: link.companyNumber ?? "",
        directorName: link.directorName ?? "",
        prevFirmName,
        today,
      },
    });
    if (!r.ok) { emailed = false; emailError = r.error ?? "send failed"; }
  } catch (e) {
    emailed = false;
    emailError = e instanceof Error ? e.message : String(e);
  }

  // Remember it, so signing later does not email the outgoing firm a second
  // time, and so the signing page can pre-fill these details for the client.
  try {
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        prevAccountantFirmName: prevFirmName,
        prevAccountantEmail: prevFirmEmail,
        acceptanceData: {
          ...acc,
          ...(prevFirmAddress ? { prevFirmAddress } : {}),
          clearanceSentAt: now.toISOString(),
          clearanceSentBy: session.displayName ?? session.userId,
          clearanceSentWithoutClientAuthority: true,
        },
      }),
    );
  } catch (e) {
    console.error("clearance-send: could not stamp the link:", e);
  }

  if (!emailed) {
    return NextResponse.json(
      { error: `Clearance was recorded, but the email to ${prevFirmEmail} failed: ${emailError}` },
      { status: 502 },
    );
  }
  return NextResponse.json({ success: true, sentTo: prevFirmEmail, attachedClearanceLetter: attachments.length > 0 });
}
