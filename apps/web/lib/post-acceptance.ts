/**
 * Everything that happens AFTER a client's acceptance is considered final:
 * director-doc tracking, the professional clearance request + its emails,
 * the firm notification, the client welcome/confirmation email, and the
 * signed-PDF archive.
 *
 * Extracted out of app/api/onboarding/links/[id]/accept/route.ts so it can
 * run from three places with identical behaviour:
 *   1. accept/route.ts itself — immediately, for manual-payment/non-DD
 *      acceptances that don't need to wait on anything.
 *   2. app/api/webhooks/gocardless/route.ts — once a Direct Debit mandate
 *      that was gating acceptance (status "pending_dd") is confirmed active.
 *   3. gocardless-retry/route.ts — when staff manually re-run a failed
 *      mandate setup and it now succeeds.
 */
import {
  getDb,
  insertClearanceRequest,
  initDocumentSubmissions,
} from "@gns/db";
import type { FirmConfig } from "./firms";
import { sendMail } from "./mailer";
import { sendTemplatedMail } from "./send-templated-mail";
import { buildClearancePdf, clearancePdfFilename } from "./clearance-pdf";
import { buildAuthorityLetterPdf, authorityLetterFilename } from "./authority-letter-pdf";
import { buildFirmNewClientEmail } from "./email-constants";
import { archiveToClientFolder } from "./storage";
import type { LetterService, CustomFee, ScopeRow, ChDetails } from "./letter-html";

interface DocStatus { id: string; label: string; status: string }

export interface PostAcceptanceLink {
  id: string;
  token: string;
  companyName: string | null;
  companyNumber: string | null;
  clientEmail: string;
  directorName: string | null;
  firmSlug: string | null;
  services: unknown;
  sentAt: Date | string;
  letterMeta?: Record<string, unknown> | null;
}

export interface PostAcceptanceMeta {
  partnerName?: string;
  regBody?: string;
  clientAddress?: string;
  ch?: ChDetails | null;
  customFees?: CustomFee[];
  scopeRows?: ScopeRow[];
  paymentMethod?: string;
  includeAnnexA?: boolean;
  clientType?: string;
  clientName?: string;
  utr?: string;
}

export interface PostAcceptanceContext {
  link: PostAcceptanceLink;
  token: string;
  mode: "details_only" | "proposal_only" | "engagement";
  firm: FirmConfig;
  meta: PostAcceptanceMeta;
  appUrl: string;
  today: string;
  now: Date;
  signatureName: string;
  contactPrefs: string[];
  directorDocs: DocStatus[];
  companyDocs: DocStatus[];
  prevFirmName?: string | null;
  prevEmail?: string | null;
  prevPhone?: string | null;
  noPrevAccountant?: boolean;
  ipAddress: string;
  userAgent: string;
  documentSha256?: string;
  ddSummary: string | null;
  signedHtml: string | null;
}

export interface PostAcceptanceResult {
  signedLetterUrl: string | null;
  uploadUrl: string;
  message: string;
}

export async function runPostAcceptanceEffects(ctx: PostAcceptanceContext): Promise<PostAcceptanceResult> {
  const {
    link, token, mode, firm, meta, appUrl, today, now,
    signatureName, contactPrefs, directorDocs, companyDocs,
    prevFirmName, prevEmail, prevPhone, noPrevAccountant,
    ipAddress, userAgent, documentSha256, ddSummary, signedHtml,
  } = ctx;
  const db = getDb();

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
          signatureName: signatureName.trim(),
          signedAtIso: now.toISOString(),
          signerEmail: link.clientEmail,
          companyName: link.companyName ?? "",
          companyNumber: link.companyNumber ?? undefined,
          ipAddress, userAgent, documentSha256,
          contactPrefs: contactPrefs ?? [], ddSummary,
          token, firmName: firm.legalName, firmEmail: firm.email,
          createdAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
          emailedAtIso: link.sentAt ? new Date(link.sentAt).toISOString() : null,
          firstViewedAtIso: (link.letterMeta?.firstViewedAt as string) ?? null,
          firstViewIp: (link.letterMeta?.firstViewIp as string) ?? null,
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

  // EMAIL → PREVIOUS ACCOUNTANT: professional clearance request (editable template)
  if (!noPrevAccountant && prevEmail) {
    const clearanceAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    // 1) Professional clearance letter (GNS → outgoing accountant).
    try {
      const buffer = await buildClearancePdf({
        firm,
        clientName: link.companyName ?? "",
        companyNumber: link.companyNumber ?? undefined,
        directorName: link.directorName ?? undefined,
        prevFirmName: prevFirmName || "Previous Accountants",
        // Signed by the partner who issued this client's engagement letter.
        partnerName: meta.partnerName,
        today,
      });
      clearanceAttachments.push({
        filename: clearancePdfFilename(link.companyName ?? "Client"),
        content: buffer,
        contentType: "application/pdf",
      });
    } catch (e) {
      console.error("Clearance PDF generation failed (sending without attachment):", e);
    }
    // 2) Client authority (change of accountants) letter — the client's written
    // authority for the outgoing accountant to release records to us.
    try {
      const authBuffer = await buildAuthorityLetterPdf({
        firm,
        clientName: link.companyName ?? "",
        companyNumber: link.companyNumber ?? undefined,
        // The client's own address — this letter is on plain paper with the
        // client as sender, so without it the letterhead block is bare.
        clientAddress: meta.clientAddress,
        directorName: link.directorName ?? undefined,
        prevFirmName: prevFirmName || "Previous Accountants",
        today,
      });
      clearanceAttachments.push({
        filename: authorityLetterFilename(link.companyName ?? "Client"),
        content: authBuffer,
        contentType: "application/pdf",
      });
    } catch (e) {
      console.error("Authority letter generation failed (sending without it):", e);
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
  const docUploadUrl = `${appUrl}/onboarding/documents/${token}`;
  if (mode === "engagement") {
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
          // &pdf=1 → the real signed PDF as a download, not the HTML view.
          signedContractUrl: `${appUrl}/api/onboarding/links/${token}/letter?signed=1&pdf=1`,
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

  return {
    signedLetterUrl: signedHtml ? `/api/onboarding/links/${token}/letter?signed=1&pdf=1` : null,
    uploadUrl: `/onboarding/documents/${token}`,
    message: mode === "details_only"
      ? "Thank you — your previous accountant's details have been received."
      : mode === "proposal_only"
        ? "Thank you — your proposal has been approved. We'll send your engagement letter shortly."
        : !noPrevAccountant
          ? "Contract signed. Previous accountant notified and firm alerted."
          : "Contract signed. Welcome to the firm.",
  };
}
