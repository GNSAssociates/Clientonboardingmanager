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
import { setupDirectDebitMandate } from "@/lib/gocardless";
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
    directDebit,
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
    directDebit?: { accountName?: string; accountNumber?: string; sortCode?: string; bankAddress?: string } | null;
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

    const cleanSortCode = (directDebit?.sortCode ?? "").replace(/\D/g, "");
    const cleanAccountNo = (directDebit?.accountNumber ?? "").replace(/\D/g, "");
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
    if (mode === "engagement" && !isManualPayment) {
      // Direct Debit mandate is a compulsory part of the contract (unless the
      // engagement was set up for manual invoicing)
      if (!directDebit?.accountName?.trim()) {
        return NextResponse.json({ error: "Direct Debit: account holder's name is required" }, { status: 400 });
      }
      if (cleanAccountNo.length < 6 || cleanAccountNo.length > 8) {
        return NextResponse.json({ error: "Direct Debit: a valid UK account number (6–8 digits) is required" }, { status: 400 });
      }
      if (cleanSortCode.length !== 6) {
        return NextResponse.json({ error: "Direct Debit: a valid 6-digit sort code is required" }, { status: 400 });
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

    // ── GoCardless Direct Debit mandate — created (and, when required to gate
    //    acceptance, must succeed) BEFORE we write anything, so a rejected
    //    bank account leaves no half-finished record and the client can just
    //    correct their details and resubmit. ─────────────────────────────────
    const requiresDdGate = mode === "engagement" && !isManualPayment && !!directDebit?.accountName;
    let gcResult: Record<string, unknown> | null = null;
    if (mode === "engagement" && directDebit?.accountName) {
      const gc = await setupDirectDebitMandate({
        firmSlug: link.firmSlug || "gns",
        companyName: link.companyName ?? "",
        directorName: signatureName || link.directorName || "",
        email: link.clientEmail,
        dd: {
          accountName: directDebit.accountName,
          accountNumber: cleanAccountNo,
          sortCode: cleanSortCode,
          bankAddress: directDebit.bankAddress,
        },
        token,
        // Structured billing address (from the Companies House autofill / manual
        // entry) so the GoCardless customer carries a proper address.
        address: (meta as Record<string, unknown>).clientAddressStructured as {
          line1?: string; line2?: string; city?: string; region?: string; postcode?: string;
        } | undefined,
      });
      gcResult = gc as unknown as Record<string, unknown>;
    }
    // Mandate *creation* only ever reaches "pending_submission" — this is not
    // yet a confirmed mandate. When GoCardless is configured for this firm,
    // hold the client here until the webhook confirms it's actually active;
    // an outright creation failure (bad account/sort code, API error) blocks
    // immediately with nothing written, so they can just correct and retry.
    const gcConfigured = !!(gcResult && (gcResult as { configured?: boolean }).configured);
    const gcSucceeded = !!(gcResult && (gcResult as { success?: boolean }).success);
    if (requiresDdGate && gcConfigured && !gcSucceeded) {
      return NextResponse.json(
        { error: (gcResult as { error?: string })?.error || "We could not set up your Direct Debit mandate — please check your account details and try again." },
        { status: 502 }
      );
    }
    const pendingDd = requiresDdGate && gcConfigured && gcSucceeded;

    // ── Signed copy with audit certificate ────────────────────────────────────
    // Built BEFORE the status write: it's pure CPU work, and the status write
    // must not land without the mandate id beside it (see the single write below).
    const ddSummary = directDebit?.accountName
      ? `${directDebit.accountName} · ****${cleanAccountNo.slice(-4)} · ${cleanSortCode.slice(0, 2)}-**-**`
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
          directDebit: directDebit ?? null,
          gocardless: gcResult,
          directorDocs: directorDocs ?? [],
          companyDocs: companyDocs ?? [],
          prevPhone: noPrevAccountant ? null : (prevPhone || null),
          prevFirmAddress: noPrevAccountant ? null : (prevAddress || null),
          audit: { ipAddress, userAgent, documentSha256 },
        },
      })
    );

    // ── DD gate active: stop here. The client sits on a "pending_dd" screen
    //    until the GoCardless webhook confirms the mandate is active, at which
    //    point apps/web/app/api/webhooks/gocardless/route.ts runs everything
    //    below (clearance emails, welcome email, PDF archive) for us. ────────
    if (pendingDd) {
      return NextResponse.json({
        success: true,
        pending: true,
        mode,
        mandateId: (gcResult as { mandateId?: string } | null)?.mandateId ?? null,
        message: "Your Direct Debit details have been submitted. We're waiting for your bank to confirm the mandate — this page will update automatically, usually within a few seconds.",
      });
    }

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
      gocardless: gcConfigured ? { success: gcSucceeded } : null,
      message: postResult.message,
    });
  } catch (error) {
    console.error("Error accepting engagement:", error);
    return NextResponse.json({ error: "Failed to accept engagement" }, { status: 500 });
  }
}
