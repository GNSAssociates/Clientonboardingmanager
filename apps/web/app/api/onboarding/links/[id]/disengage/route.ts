/**
 * Disengagement: preview the letter, then send it and close the file.
 *
 * Two modes, because the engagement side works the same way and staff should
 * not have to learn a second shape for the same job:
 *   mode "preview" — builds the letter and returns it. Changes nothing.
 *   mode "send"    — builds it, cancels the Direct Debit, emails the client,
 *                    files a copy in their OneDrive folder, closes the file.
 *
 * The order in "send" is deliberate. The letter is built first, so nothing is
 * cancelled or closed on the strength of a letter that could not be produced.
 * The closure is written last, carrying what actually happened to the mandate
 * and the email, so the record never claims more than was done.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { buildDisengagementPdf, disengagementPdfFilename } from "@/lib/disengagement-pdf";
import { cancelMandate } from "@/lib/gocardless";
import { archiveToClientFolder } from "@/lib/storage";
import { getOneDriveFolderLink } from "@/lib/onedrive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ukDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = params.id;
  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    mode?: "preview" | "send";
    ceasedOn?: string;
    reason?: string;
    services?: string[];
    lastWorkDone?: string;
    clientMustNowDo?: string[];
    outstandingFees?: string;
    extraNotes?: string;
    sendEmail?: boolean;
    cancelDirectDebit?: boolean;
  };
  const mode = body.mode === "send" ? "send" : "preview";

  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  if (mode === "send" && acc.disengagedAt) {
    return NextResponse.json(
      { error: `This client was already disengaged on ${ukDate(String(acc.disengagedAt).slice(0, 10))}.` },
      { status: 409 },
    );
  }

  /* The date we ceased to act is the one fact this letter exists to record,
     so it is never defaulted to today on someone's behalf. */
  const ceasedOn = (body.ceasedOn ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ceasedOn)) {
    return NextResponse.json(
      { error: "A cessation date is required (YYYY-MM-DD) — it decides who was responsible for what." },
      { status: 400 },
    );
  }

  const clientName = (link.companyName ?? "").trim();
  if (!clientName) {
    return NextResponse.json(
      { error: "This client has no company name on file, so the letter cannot be addressed." },
      { status: 400 },
    );
  }

  const firm = getFirm(link.firmSlug ?? "gns");

  let pdf: Buffer;
  try {
    pdf = await buildDisengagementPdf({
      firm,
      clientName,
      companyNumber: link.companyNumber ?? undefined,
      directorName: link.directorName ?? undefined,
      clientAddress: (acc.clientAddress as string) ?? undefined,
      ceasedOn: ukDate(ceasedOn),
      services: body.services?.filter(Boolean),
      lastWorkDone: body.lastWorkDone?.trim() || undefined,
      clientMustNowDo: body.clientMustNowDo?.filter(Boolean),
      outstandingFees: body.outstandingFees?.trim() || undefined,
      extraNotes: body.extraNotes?.trim() || undefined,
      today: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    });
  } catch (e) {
    console.error("disengagement letter failed to build:", e);
    return NextResponse.json(
      { error: "The disengagement letter could not be produced, so nothing was sent, cancelled or closed." },
      { status: 500 },
    );
  }

  const filename = disengagementPdfFilename(clientName);

  /* Preview stops here — the letter, and a way into the client's folder, with
     nothing changed. */
  if (mode === "preview") {
    const folderUrl = await getOneDriveFolderLink(clientName).catch(() => null);
    const gc = (acc.gocardless ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      mode: "preview",
      filename,
      pdfBase64: pdf.toString("base64"),
      oneDriveFolderUrl: folderUrl,
      clientEmail: link.clientEmail,
      hasMandate: Boolean(gc.mandateId),
      mandateId: gc.mandateId ? String(gc.mandateId) : null,
    });
  }

  /* ── send ─────────────────────────────────────────────────────────────── */

  // 1. The mandate. Done before the email so the client is not told the
  //    engagement has ended while we can still collect from them.
  let mandateCancelled: boolean | null = null;
  let mandateError: string | null = null;
  const gc = (acc.gocardless ?? {}) as Record<string, unknown>;
  const mandateId = gc.mandateId ? String(gc.mandateId) : "";
  if (body.cancelDirectDebit !== false && mandateId) {
    const r = await cancelMandate(link.firmSlug ?? "gns", mandateId);
    mandateCancelled = r.ok;
    if (!r.ok) mandateError = r.error ?? "cancel failed";
  }

  // 2. The letter to the client.
  let emailed = false;
  let emailError: string | null = null;
  if (body.sendEmail !== false && link.clientEmail) {
    try {
      const r = await sendTemplatedMail({
        key: "client_disengagement",
        firm,
        token,
        to: link.clientEmail,
        toName: link.directorName ?? clientName,
        replyTo: firm.email,
        vars: {
          directorName: link.directorName ?? "Sir or Madam",
          companyName: clientName,
          firmLegalName: firm.legalName,
          ceasedOn: ukDate(ceasedOn),
        },
        attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
      });
      emailed = r.ok;
      if (!r.ok) emailError = r.error ?? "send failed";
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
      console.error("disengagement email failed:", e);
    }
  }

  // 3. A copy where the client's records live. Best effort: an unreachable
  //    drive must not stop the engagement being recorded as ended.
  let archivedTo: string | null = null;
  try {
    const archived = await archiveToClientFolder({
      companyName: clientName,
      fileName: filename,
      content: pdf,
      mimeType: "application/pdf",
    });
    if (archived) archivedTo = archived.path;
  } catch (e) {
    console.error("disengagement letter could not be filed in OneDrive:", e);
  }

  // 4. Close the file, recording what actually happened rather than what was
  //    intended.
  await db.transaction((tx) =>
    updateOnboardingLink(tx, link.id, {
      acceptanceData: {
        ...acc,
        disengagedAt: new Date().toISOString(),
        disengagedCeasedOn: ceasedOn,
        disengagedBy: session.userId,
        disengagementReason: body.reason ?? null,
        disengagementEmailed: emailed,
        disengagementMandateCancelled: mandateCancelled,
        disengagementArchivedTo: archivedTo,
      },
    }),
  );

  return NextResponse.json({
    ok: true,
    mode: "send",
    emailed, emailError,
    mandateCancelled, mandateError,
    archivedTo,
    ceasedOn,
    filename,
    pdfBase64: pdf.toString("base64"),
  });
}
