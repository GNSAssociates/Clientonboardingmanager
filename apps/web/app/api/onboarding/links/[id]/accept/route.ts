import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  getDb,
  getOnboardingLinkByToken,
  updateOnboardingLink,
} from "@gns/db";
import { getFirm } from "@/lib/firms";
import { buildLetterHtml, buildSignedHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";
import { loadEngagementLetterOverrides } from "@/lib/template-overrides.server";
import { getBillingRequestStatus } from "@/lib/gocardless";
import { runPostAcceptanceEffects, type PostAcceptanceContext } from "@/lib/post-acceptance";

export const dynamic = "force-dynamic";

interface DocStatus { id: string; label: string; status: string }

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
    prevAddress,
    noPrevAccountant,
    directorDocs,
    companyDocs,
    signatureName,
    contactPrefs,
    authorised,
  } = body as {
    prevFirmName?: string;
    prevEmail?: string;
    prevPhone?: string;
    prevAddress?: string;
    noPrevAccountant?: boolean;
    directorDocs?: DocStatus[];
    companyDocs?: DocStatus[];
    signatureName?: string;
    contactPrefs?: string[];
    directDebitConfirmed?: boolean | null;
    authorised?: boolean;
    confirmEmail?: string;
  };
  const { confirmEmail } = body as { confirmEmail?: string };

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
    if (link.status === "pending_dd") {
      return NextResponse.json({ error: "Your Direct Debit mandate is already being confirmed — please wait." }, { status: 409 });
    }

    const meta = (link.letterMeta ?? {}) as {
      sendMode?: string; partnerName?: string; customFees?: CustomFee[];
      scopeRows?: ScopeRow[]; clientAddress?: string; ch?: ChDetails | null; regBody?: string;
      paymentMethod?: string; includeAnnexA?: boolean; clientType?: string;
      clientName?: string; utr?: string;
    };
    const isManualPayment = meta.paymentMethod === "manual";
    // details_only  → collects prev-accountant details only
    // proposal_only → client approves the proposal (light: no DD/clearance/docs)
    // engagement/proposal → full signable contract
    const rawMode = meta.sendMode ?? "engagement";
    const mode = rawMode === "details_only" ? "details_only"
      : rawMode === "proposal_only" ? "proposal_only"
      : "engagement";
    const firm = getFirm(link.firmSlug || "gns");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const now = new Date();
    const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // ── Validation ────────────────────────────────────────────────────────────
    // Proposal-only doesn't collect previous-accountant details.
    if (mode !== "proposal_only" && !noPrevAccountant && (!prevFirmName || !prevEmail)) {
      return NextResponse.json({ error: "Previous accountant details are required" }, { status: 400 });
    }

    // Only the person the link was emailed to may sign — the signer must
    // confirm the email address the signing link was issued to.
    const normalise = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();
    if (normalise(confirmEmail) !== normalise(link.clientEmail)) {
      return NextResponse.json(
        { error: "Email verification failed — please enter the email address this letter was sent to" },
        { status: 403 }
      );
    }

    // Both modes are signed: engagement signs the contract, details-only signs
    // the authorisation to approach the previous accountant.
    if (!authorised) {
      return NextResponse.json({ error: "Declaration not accepted" }, { status: 400 });
    }
    if (!signatureName || signatureName.trim().length < 2) {
      return NextResponse.json({ error: "Signature (typed full name) is required" }, { status: 400 });
    }
    // ── Direct Debit gate (server-authoritative) ─────────────────────────────
    // The client sets up the mandate on GoCardless's hosted page (Billing
    // Requests) BEFORE signing. We never see bank details — we verify with
    // GoCardless that the billing request is fulfilled (a mandate exists), and
    // refuse to record the signature otherwise. This enforces the firm's rule:
    // "if DD is not succeeded, the engagement cannot be signed."
    const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
    const storedGc = (acc.gocardless ?? {}) as Record<string, unknown>;
    let ddMandateId = (storedGc.mandateId as string | undefined) ?? undefined;
    let ddConfirmed = Boolean(storedGc.ddConfirmed);
    if (mode === "engagement" && !isManualPayment) {
      const billingRequestId = storedGc.billingRequestId as string | undefined;
      if (!ddConfirmed && billingRequestId) {
        // Re-check live so a client can't submit a stale/unconfirmed flag.
        const st = await getBillingRequestStatus(link.firmSlug || "gns", billingRequestId);
        if (st.fulfilled) { ddConfirmed = true; ddMandateId = st.mandateId ?? ddMandateId; }
      }
      if (!ddConfirmed) {
        return NextResponse.json(
          { error: "Please set up your Direct Debit with GoCardless before signing — it has not been confirmed yet." },
          { status: 400 }
        );
      }
    }

    // ── E-signature audit trail (UK eIDAS / ECA 2000) ─────────────────────────
    const ipAddress = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim()
      || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    // The letter as presented — hash forms the tamper-evidence fingerprint
    let letterHtml = link.letterHtml ?? null;
    if (!letterHtml && mode === "engagement") {
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
        appUrl,
        paymentMethod: meta.paymentMethod,
        includeAnnexA: meta.includeAnnexA,
        clientType: meta.clientType,
        clientName: meta.clientName,
        utr: meta.utr,
      });
    }
    const documentSha256 = letterHtml ? createHash("sha256").update(letterHtml).digest("hex") : undefined;

    // ── GoCardless Direct Debit — the mandate was already created and confirmed
    //    on GoCardless's hosted page (verified above), so there is nothing to
    //    submit here. We simply carry the confirmed mandate/billing-request ids
    //    forward into the acceptance record. No "pending_dd" wait is needed. ──
    const gcResult: Record<string, unknown> | null =
      (mode === "engagement" && !isManualPayment)
        ? { ...storedGc, configured: true, success: true, ddConfirmed, mandateId: ddMandateId }
        : null;
    const pendingDd = false;

    // ── Signed copy with audit certificate ────────────────────────────────────
    // Built BEFORE the status write: it's pure CPU work, and the status write
    // must not land without the mandate id beside it (see the single write below).
    const ddSummary = ddMandateId
      ? `GoCardless Direct Debit mandate ${ddMandateId} (confirmed)`
      : null;
    let signedHtml: string | null = null;
    if (mode === "engagement" && letterHtml) {
      const metaAll = (link.letterMeta ?? {}) as Record<string, unknown>;
      signedHtml = buildSignedHtml(letterHtml, {
        signatureName: signatureName!.trim(),
        signedAtIso: now.toISOString(),
        signerEmail: link.clientEmail,
        companyName: link.companyName ?? "",
        companyNumber: link.companyNumber ?? undefined,
        ipAddress,
        userAgent,
        documentSha256,
        contactPrefs: contactPrefs ?? [],
        ddSummary,
        token,
        // Agreement history for the audit report
        firmName: firm.legalName,
        firmEmail: firm.email,
        createdAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
        emailedAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
        firstViewedAtIso: (metaAll.firstViewedAt as string) ?? null,
        firstViewIp: (metaAll.firstViewIp as string) ?? null,
      });
    }

    // ── Mark accepted (or "pending_dd" when a mandate is gating this), and
    //    persist the acceptance record — in ONE write.
    //
    //    These must be atomic: the GoCardless webhook locates a client by the
    //    mandate id inside acceptanceData, so if the status landed first and
    //    the mandate id only afterwards, an "active" webhook arriving in that
    //    window would match nothing, be skipped, and strand the client in
    //    pending_dd forever. Sandbox mandates activate in seconds, so that
    //    window is realistically hit. Splitting it also risked the webhook's
    //    masking of the bank details being clobbered by the second write.
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        status: pendingDd ? "pending_dd" : "accepted",
        acceptedAt: pendingDd ? null : now,
        prevAccountantEmail: noPrevAccountant ? null : (prevEmail || null),
        prevAccountantFirmName: noPrevAccountant ? null : (prevFirmName || null),
        signedHtml,
        acceptanceData: {
          mode,
          signatureName: signatureName || link.directorName || null,
          signedAt: now.toISOString(),
          contactPrefs: contactPrefs ?? [],
          gocardless: gcResult,
          directorDocs: directorDocs ?? [],
          companyDocs: companyDocs ?? [],
          prevPhone: noPrevAccountant ? null : (prevPhone || null),
          prevFirmAddress: noPrevAccountant ? null : (prevAddress || null),
          audit: { ipAddress, userAgent, documentSha256 },
        },
      })
    );

    const postCtx: PostAcceptanceContext = {
      link: { ...link, letterMeta: (link.letterMeta ?? {}) as Record<string, unknown> },
      token, mode, firm, meta, appUrl, today, now,
      signatureName: signatureName!.trim(),
      contactPrefs: contactPrefs ?? [],
      directorDocs: directorDocs ?? [],
      companyDocs: companyDocs ?? [],
      prevFirmName, prevEmail, prevPhone, prevFirmAddress: prevAddress, noPrevAccountant,
      ipAddress, userAgent, documentSha256, ddSummary, signedHtml,
    };
    const postResult = await runPostAcceptanceEffects(postCtx);

    return NextResponse.json({
      success: true,
      mode,
      signedLetterUrl: postResult.signedLetterUrl,
      uploadUrl: postResult.uploadUrl,
      gocardless: gcResult ? { success: true } : null,
      message: postResult.message,
    });
  } catch (error) {
    console.error("Error accepting engagement:", error);
    return NextResponse.json({ error: "Failed to accept engagement" }, { status: 500 });
  }
}
