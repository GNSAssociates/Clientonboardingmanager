/**
 * Disengagement: produce the letter, send it, close the file.
 *
 * Deliberately narrow. It does not answer an incoming accountant's clearance
 * enquiry and does not cancel anything at GoCardless — those are decisions a
 * person should make, not side effects of pressing a button. It writes the
 * letter that ends the engagement and records that we ceased to act.
 *
 * The closure is stored on the link rather than deleting anything: a client
 * who left is still a client we acted for, and the file has to stand up years
 * later. Nothing is ever removed here.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { buildDisengagementPdf, disengagementPdfFilename } from "@/lib/disengagement-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ukDate = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-GB", {
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
    ceasedOn?: string;
    reason?: string;
    services?: string[];
    lastWorkDone?: string;
    clientMustNowDo?: string[];
    outstandingFees?: string;
    extraNotes?: string;
    /** False to produce the letter without emailing it — some partners post it. */
    sendEmail?: boolean;
  };

  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  if (acc.disengagedAt) {
    return NextResponse.json(
      { error: `This client was already disengaged on ${ukDate(String(acc.disengagedAt).slice(0, 10))}.` },
      { status: 409 },
    );
  }

  /* The date we ceased to act is the one fact this letter exists to record, so
     it is not defaulted to today behind the user's back. */
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
      { error: "The disengagement letter could not be produced, so nothing was sent or closed." },
      { status: 500 },
    );
  }

  // Send before closing. A file marked closed with no letter sent is the one
  // state that leaves nobody knowing the engagement ended.
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
        attachments: [{
          filename: disengagementPdfFilename(clientName),
          content: pdf,
          contentType: "application/pdf",
        }],
      });
      emailed = r.ok;
      if (!r.ok) emailError = r.error ?? "send failed";
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
      console.error("disengagement email failed:", e);
    }
  }

  await db.transaction((tx) =>
    updateOnboardingLink(tx, link.id, {
      acceptanceData: {
        ...acc,
        disengagedAt: new Date().toISOString(),
        disengagedCeasedOn: ceasedOn,
        disengagedBy: session.userId,
        disengagementReason: body.reason ?? null,
        disengagementEmailed: emailed,
      },
    }),
  );

  return NextResponse.json({
    ok: true,
    emailed,
    emailError,
    ceasedOn,
    filename: disengagementPdfFilename(clientName),
    pdfBase64: pdf.toString("base64"),
  });
}
