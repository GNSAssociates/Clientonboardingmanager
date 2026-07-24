import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  getDb,
  getOnboardingLinkByToken,
  updateOnboardingLink,
  insertClearanceRequest,
  initDocumentSubmissions,
} from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { buildClearanceDocx, clearanceDocFilename } from "@/lib/clearance-doc";
import { buildFirmNewClientEmail } from "@/lib/email-constants";
import { buildLetterHtml, buildSignedHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";
import { setupDirectDebitMandate } from "@/lib/gocardless";
import { archiveToClientFolder } from "@/lib/storage";

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
      letterHtml = buildLetterHtml({
        firm,
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

    // ── Mark accepted (the critical write) ────────────────────────────────────
    await db.transaction((tx) =>
      updateOnboardingLink(tx, link.id, {
        status: "accepted",
        acceptedAt: now,
        prevAccountantEmail: noPrevAccountant ? null : (prevEmail || null),
        prevAccountantFirmName: noPrevAccountant ? null : (prevFirmName || null),
      })
    );

    // ── GoCardless Direct Debit mandate (auto per firm; no-op until token set) ─
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
      });
      gcResult = gc as unknown as Record<string, unknown>;
    }

    // ── Signed copy with audit certificate ────────────────────────────────────
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

    // ── Persist full acceptance record (non-fatal) ────────────────────────────
    try {
      await db.transaction((tx) =>
        updateOnboardingLink(tx, link.id, {
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
            audit: { ipAddress, userAgent, documentSha256 },
          },
        })
      );
    } catch (e) {
      console.error("Failed to persist acceptance data (non-fatal):", e);
    }

    // ── Archive the SIGNED copy as a proper PDF (contract + Final Audit Report)
    //    to OneDrive / Dropbox, folder = client name. Non-fatal.
    if (signedHtml) {
      try {
        const { renderLetterPdf } = await import("@/lib/letter-pdf");
        const signedPdf = await renderLetterPdf({
          firm, regBody: meta.regBody ?? firm.regBody,
          companyName: link.companyName ?? "", companyNumber: link.companyNumber ?? undefined,
          clientAddress: meta.clientAddress, directorName: link.directorName ?? undefined,
          partnerName: meta.partnerName, services: (link.services ?? []) as LetterService[],
          customFees: meta.customFees ?? [], scopeRows: meta.scopeRows ?? undefined,
          ch: meta.ch ?? null,
          paymentMethod: meta.paymentMethod, includeAnnexA: meta.includeAnnexA,
          clientType: meta.clientType, clientName: meta.clientName, utr: meta.utr,
          dateStr: new Date(link.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
          audit: {
            signatureName: signatureName!.trim(),
            signedAtIso: now.toISOString(),
            signerEmail: link.clientEmail,
            companyName: link.companyName ?? "",
            companyNumber: link.companyNumber ?? undefined,
            ipAddress, userAgent, documentSha256,
            contactPrefs: contactPrefs ?? [], ddSummary,
            token, firmName: firm.legalName, firmEmail: firm.email,
            createdAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
            emailedAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
            firstViewedAtIso: ((link.letterMeta ?? {}) as Record<string, unknown>).firstViewedAt as string ?? null,
            firstViewIp: ((link.letterMeta ?? {}) as Record<string, unknown>).firstViewIp as string ?? null,
          },
        });
        await archiveToClientFolder({
          companyName: link.companyName ?? "client",
          fileName: `SIGNED - Engagement Letter - ${link.companyName} - ${today}.pdf`,
          content: signedPdf,
          mimeType: "application/pdf",
        });
      } catch (e) {
        console.error("Signed-PDF archive failed (non-fatal):", e instanceof Error ? e.message : e);
      }
    }

    // ── Director ID docs: ready/later → chase the CLIENT every 2 days;
    //    'na' → requested from the PREVIOUS ACCOUNTANT via clearance instead ───
    const DIRECTOR_DOC_MAP: Record<string, { id: string; label: string }> = {
      photo_id: { id: "passport_photo_page", label: "Photo ID — Passport or Driving Licence" },
      proof_address: { id: "proof_of_address", label: "Proof of Address" },
    };
    try {
      const toTrack = (directorDocs ?? [])
        .filter((d) => d.status !== "na" && DIRECTOR_DOC_MAP[d.id])
        .map((d) => DIRECTOR_DOC_MAP[d.id]!);
      if (toTrack.length > 0) {
        await db.transaction((tx) => initDocumentSubmissions(tx, token, toTrack));
      }
    } catch (e) {
      console.error("Failed to init document submissions (non-fatal):", e);
    }

    // ── Clearance request — items tracked with ids so staff can tick them off ─
    const mkItem = (id: string, type: string, label: string, year: string) =>
      ({ id, type, label, year, status: "pending" as const, receivedDate: null, notes: "" });
    const clearanceItems = [
      mkItem("bookkeeping", "AA", "Bookkeeping Files / Working Files", "Current"),
      mkItem("pl_bs", "AA", "P&L and Balance Sheet ledgers (detailed breakdown)", "Previous"),
      mkItem("trial_balance", "AA", "Current Year YTD Trial Balance", "Current"),
      mkItem("filed_accounts", "CT", "Detailed P&L, BS, schedules, capital allowances, DLA, s455", "Last 2 years"),
      mkItem("personal_tax", "SA", "Director's personal tax returns + P60s/P45s", "Last 2 years"),
      mkItem("online_access", "REFS", "Online access (MTD software, HMRC, Companies House, NEST)", "All"),
      mkItem("tax_refs", "REFS", "Tax references (UTR, CH Auth Code, VAT cert, PAYE refs, NI)", "All"),
      mkItem("payroll_rti", "PAYROLL", "Payroll RTI & Pensions records", "Current + 2 years"),
      mkItem("vat_returns", "VAT", "VAT returns (last 4 quarters) + HMRC correspondence", "Last 4 quarters"),
      // Director docs marked "not applicable to me" are requested from the previous accountant
      ...(directorDocs ?? [])
        .filter((d) => d.status === "na")
        .map((d) => mkItem(`director_${d.id}`, "REFS", `${d.label} (director's copy held on your file)`, "All")),
    ];

    if (!noPrevAccountant && prevEmail) {
      try {
        await db.transaction((tx) =>
          insertClearanceRequest(tx, {
            prevFirmName: prevFirmName || "Previous Accountants",
            prevFirmEmail: prevEmail,
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
              prevPhone: prevPhone || null,
              directorDocs: directorDocs ?? [],
              companyDocs: companyDocs ?? [],
              docItems: clearanceItems,
            },
          })
        );
      } catch (clearanceErr) {
        console.error("Failed to auto-create clearance request:", clearanceErr);
      }
    }

    const emailErrors: string[] = [];
    const clearanceUrl = `${appUrl}/clearance/respond/${token}`;

    // EMAIL → PREVIOUS ACCOUNTANT: professional clearance request (editable template)
    if (!noPrevAccountant && prevEmail) {
      void clearanceUrl;
      let clearanceAttachments;
      try {
        const buffer = await buildClearanceDocx({
          firm,
          clientName: link.companyName ?? "",
          companyNumber: link.companyNumber ?? undefined,
          directorName: link.directorName ?? undefined,
          prevFirmName: prevFirmName || "Previous Accountants",
          today,
        });
        clearanceAttachments = [{
          filename: clearanceDocFilename(link.companyName ?? "Client"),
          content: buffer,
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }];
      } catch (e) {
        console.error("Clearance .docx generation failed (sending without attachment):", e);
      }
      try {
        const r = await sendTemplatedMail({
          key: "prev_clearance_request",
          firm,
          token,
          to: prevEmail,
          toName: prevFirmName || "Previous Accountant",
          replyTo: firm.email,
          attachments: clearanceAttachments,
          // Firm policy: CC the client and info@ (info@ added centrally by the
          // template CC map) on the clearance request. No other shared inbox.
          cc: link.clientEmail || undefined,
          noGlobalCc: true,
          vars: {
            companyName: link.companyName ?? "",
            companyNumber: link.companyNumber ?? "",
            directorName: link.directorName ?? "",
            prevFirmName: prevFirmName || "Previous Accountants",
            today,
          },
        });
        if (!r.ok) emailErrors.push(`clearance: ${r.error ?? "send failed"}`);
      } catch (e) {
        emailErrors.push(`clearance: ${e instanceof Error ? e.message : String(e)}`);
        console.error("Clearance email failed:", e);
      }
    }

    // EMAIL → FIRM: notification
    try {
      await sendMail({
        to: firm.email,
        subject: mode === "details_only"
          ? `Previous accountant details received — ${link.companyName}`
          : mode === "proposal_only"
          ? `Proposal approved — ${link.companyName} (send engagement letter next)`
          : `New Client Signed — ${link.companyName}`,
        html: buildFirmNewClientEmail({
          firm,
          companyName: link.companyName ?? "",
          companyNumber: link.companyNumber ?? "",
          directorName: link.directorName ?? "",
          clientEmail: link.clientEmail,
          services: (link.services ?? []) as Array<{ id: string; name: string; price: number }>,
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

    // EMAIL → DIRECTOR: welcome + their signed copy (engagement mode only)
    if (mode === "engagement") {
      const docUploadUrl = `${appUrl}/onboarding/documents/${token}`;
      try {
        const r = await sendTemplatedMail({
          key: "client_welcome",
          firm,
          token,
          to: link.clientEmail,
          toName: link.directorName || undefined,
          replyTo: firm.email,
          actionUrl: docUploadUrl,
          vars: {
            companyName: link.companyName ?? "",
            directorName: link.directorName ?? "",
            today,
            signedContractUrl: `${appUrl}/api/onboarding/links/${token}/letter?signed=1`,
          },
        });
        if (!r.ok) emailErrors.push(`welcome: ${r.error ?? "send failed"}`);
      } catch (e) {
        emailErrors.push(`welcome: ${e instanceof Error ? e.message : String(e)}`);
        console.error("Welcome email failed:", e);
      }
    }

    // EMAIL → CLIENT: proposal approved confirmation (proposal-only mode)
    if (mode === "proposal_only") {
      try {
        await sendMail({
          to: link.clientEmail,
          toName: link.directorName || undefined,
          subject: `Proposal approved — thank you, ${link.companyName}`,
          replyTo: firm.email,
          html: `<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;padding:24px">
            <p>Dear ${link.directorName || "Director"},</p>
            <p>Thank you for approving our proposal for <strong>${link.companyName}</strong>. We&apos;re delighted you&apos;d like to proceed.</p>
            <p>The next step is your engagement letter, which we&apos;ll send shortly to formalise the appointment. If you have any questions in the meantime, just reply to this email or call ${firm.phone}.</p>
            <p>Kind regards,<br><strong>${firm.name}</strong><br>${firm.email} · ${firm.phone}</p>
          </body></html>`,
        });
      } catch (e) {
        emailErrors.push(`proposal-confirm: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (emailErrors.length) {
      console.warn("Some emails failed (acceptance still recorded):", emailErrors);
    }

    return NextResponse.json({
      success: true,
      mode,
      signedLetterUrl: signedHtml ? `/api/onboarding/links/${token}/letter?signed=1` : null,
      uploadUrl: `/onboarding/documents/${token}`,
      gocardless: gcResult && (gcResult as { configured?: boolean }).configured
        ? { success: (gcResult as { success?: boolean }).success }
        : null,
      message: mode === "details_only"
        ? "Thank you — your previous accountant's details have been received."
        : mode === "proposal_only"
          ? "Thank you — your proposal has been approved. We'll send your engagement letter shortly."
          : !noPrevAccountant
            ? "Contract signed. Previous accountant notified and firm alerted."
            : "Contract signed. Welcome to the firm.",
    });
  } catch (error) {
    console.error("Error accepting engagement:", error);
    return NextResponse.json({ error: "Failed to accept engagement" }, { status: 500 });
  }
}
