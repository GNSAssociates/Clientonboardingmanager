/**
 * Record that a client signed a PRINTED copy of the engagement letter.
 *
 * Some clients simply will not sign in a browser. Staff print the letter, the
 * client signs it by hand, and this records that fact so the client stops being
 * chased and everything that normally follows a signature — clearance, the
 * welcome email, the archived copy — happens as it would have done.
 *
 * WHAT THIS IS NOT: an electronic signature. Nothing here forges one. The stored
 * copy says "signed on paper", carries no handwriting and no e-signature
 * certificate, and names the staff member who recorded it. The wet-signed
 * original is the executed contract and must be kept on file — this is the
 * system's record of it, which is a different thing and says so.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { buildLetterHtml, buildPaperSignedHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";
import { loadEngagementLetterOverrides } from "@/lib/template-overrides.server";
import { verifyDirectDebit } from "@/lib/gocardless";
import { runPostAcceptanceEffects, type PostAcceptanceContext } from "@/lib/post-acceptance";

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

  if (link.status === "accepted") {
    return NextResponse.json({ error: "This engagement is already recorded as signed." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({})) as {
    signatureName?: string;
    signedAt?: string;       // yyyy-mm-dd, the date on the paper copy
    ddAcknowledged?: boolean; // staff confirm they know the DD is not in place
  };

  const signatureName = (body.signatureName ?? "").trim();
  if (signatureName.length < 2) {
    return NextResponse.json({ error: "Who signed the paper copy? Their full name is needed." }, { status: 400 });
  }

  // The date on the paper copy, not today — the contract took effect when they
  // signed it, and post-dating that would misstate the engagement date.
  const signedAt = body.signedAt ? new Date(`${body.signedAt}T12:00:00Z`) : new Date();
  if (Number.isNaN(signedAt.getTime())) {
    return NextResponse.json({ error: "That signature date could not be read." }, { status: 400 });
  }
  if (signedAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "The signature date cannot be in the future." }, { status: 400 });
  }

  const meta = (link.letterMeta ?? {}) as {
    sendMode?: string; partnerName?: string; customFees?: CustomFee[];
    scopeRows?: ScopeRow[]; clientAddress?: string; ch?: ChDetails | null; regBody?: string;
    paymentMethod?: string; includeAnnexA?: boolean; clientType?: string;
    clientName?: string; utr?: string; softwareItems?: Array<{ name: string; price: number }>;
    includeClearance?: boolean;
  };
  const firm = getFirm(link.firmSlug || "gns");
  const isManualPayment = meta.paymentMethod === "manual";
  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const storedGc = (acc.gocardless ?? {}) as Record<string, unknown>;

  /* The Direct Debit gate still applies — a paper signature does not create a
     mandate. But this is staff recording something that already happened, not a
     client trying to slip past a control, so it warns and requires them to say
     they know, rather than refusing outright. The acknowledgement is recorded. */
  let ddConfirmed = false;
  let ddMandateStatus: string | undefined;
  if (!isManualPayment) {
    const v = await verifyDirectDebit(link.firmSlug || "gns", {
      billingRequestId: storedGc.billingRequestId as string | undefined,
      mandateId: storedGc.mandateId as string | undefined,
    });
    ddConfirmed = v.reachable ? v.ok : Boolean(storedGc.ddConfirmed);
    ddMandateStatus = v.mandateStatus;
    if (!ddConfirmed && !body.ddAcknowledged) {
      return NextResponse.json({
        error: "needs_dd_acknowledgement",
        message: "This client has no confirmed Direct Debit mandate. Recording a paper signature will complete their onboarding without one.",
        mandateStatus: ddMandateStatus ?? null,
      }, { status: 409 });
    }
  }

  const now = new Date();
  const today = signedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const recordedBy = session.displayName ?? session.userId;

  // The letter as it stands, then a paper-signature record appended to it.
  let letterHtml = link.letterHtml ?? null;
  if (!letterHtml) {
    const overrides = await loadEngagementLetterOverrides(firm.slug);
    letterHtml = buildLetterHtml({
      firm,
      ...overrides,
      regBody: meta.regBody ?? firm.regBody,
      companyName: link.companyName ?? "",
      companyNumber: link.companyNumber ?? undefined,
      clientAddress: meta.clientAddress,
      directorName: link.directorName ?? undefined,
      partnerName: meta.partnerName,
      services: (link.services ?? []) as LetterService[],
      customFees: meta.customFees ?? [],
      scopeRows: meta.scopeRows ?? undefined,
      ch: meta.ch ?? null,
      dateStr: new Date(link.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      paymentMethod: meta.paymentMethod,
      includeAnnexA: meta.includeAnnexA,
      clientType: meta.clientType,
      clientName: meta.clientName,
      utr: meta.utr,
    });
  }

  const signedHtml = buildPaperSignedHtml(letterHtml, {
    signatureName,
    signedAtIso: signedAt.toISOString(),
    companyName: link.companyName ?? "",
    companyNumber: link.companyNumber ?? undefined,
    firmName: firm.legalName,
    recordedBy,
    recordedAtIso: now.toISOString(),
  });

  await db.transaction((tx) =>
    updateOnboardingLink(tx, link.id, {
      status: "accepted",
      acceptedAt: signedAt,
      signedHtml,
      acceptanceData: {
        ...acc,
        mode: "engagement",
        signatureName,
        signedAt: signedAt.toISOString(),
        // The distinguishing fact. Everything downstream can tell this apart
        // from an e-signature, and no audit certificate is generated for it.
        signatureMethod: "paper",
        paperSignature: {
          recordedBy,
          recordedAt: now.toISOString(),
          ddConfirmedAtRecording: ddConfirmed,
          ...(ddMandateStatus ? { mandateStatusAtRecording: ddMandateStatus } : {}),
          ...(body.ddAcknowledged ? { staffAcknowledgedNoDirectDebit: true } : {}),
        },
      },
    })
  );

  const ctx: PostAcceptanceContext = {
    link: { ...link, letterMeta: (link.letterMeta ?? {}) as Record<string, unknown> },
    token,
    mode: "engagement",
    firm,
    meta,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    today,
    now: signedAt,
    signatureName,
    signatureImage: null,
    contactPrefs: (acc.contactPrefs as string[]) ?? [],
    directorDocs: (acc.directorDocs as Array<{ id: string; label: string; status: string }>) ?? [],
    companyDocs: (acc.companyDocs as Array<{ id: string; label: string; status: string }>) ?? [],
    prevFirmName: link.prevAccountantFirmName,
    prevEmail: link.prevAccountantEmail,
    prevPhone: (acc.prevPhone as string) ?? null,
    prevFirmAddress: (acc.prevFirmAddress as string) ?? null,
    noPrevAccountant: !link.prevAccountantEmail,
    includeClearance: meta.includeClearance !== false,
    clearanceAlreadySent: Boolean(acc.clearanceSentAt),
    // No client browser was involved, so there is no IP or user agent to claim.
    ipAddress: "n/a - signed on paper",
    userAgent: "n/a - signed on paper",
    ddSummary: null,
    signedHtml,
  };

  try {
    await runPostAcceptanceEffects(ctx);
  } catch (e) {
    // The signature is recorded either way; the effects log their own failures.
    console.error("paper-signature: post-acceptance effects failed:", e);
  }

  return NextResponse.json({ success: true, status: "accepted", signedAt: signedAt.toISOString() });
}
