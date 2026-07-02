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
import { buildClearanceRequestEmail } from "@/lib/email-clearance";
import {
  buildFirmNewClientEmail,
  buildClientWelcomeEmail,
} from "@/lib/email-constants";
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
  };

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
      scopeRows?: ScopeRow[]; clientAddress?: string; ch?: ChDetails | null;
    };
    const mode = meta.sendMode === "details_only" ? "details_only" : "engagement";
    const firm = getFirm(link.firmSlug || "gns");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const now = new Date();
    const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // ── Validation ────────────────────────────────────────────────────────────
    if (!noPrevAccountant && (!prevFirmName || !prevEmail)) {
      return NextResponse.json({ error: "Previous accountant details are required" }, { status: 400 });
    }

    const cleanSortCode = (directDebit?.sortCode ?? "").replace(/\D/g, "");
    const cleanAccountNo = (directDebit?.accountNumber ?? "").replace(/\D/g, "");
    if (mode === "engagement") {
      if (!authorised) {
        return NextResponse.json({ error: "Declaration not accepted" }, { status: 400 });
      }
      if (!signatureName || signatureName.trim().length < 2) {
        return NextResponse.json({ error: "Signature (typed full name) is required" }, { status: 400 });
      }
      // Direct Debit mandate is a compulsory part of the contract
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

    // ── Archive signed copy to OneDrive / Dropbox (non-fatal) ─────────────────
    if (signedHtml) {
      await archiveToClientFolder({
        companyName: link.companyName ?? "client",
        fileName: `SIGNED - Engagement Letter - ${link.companyName} - ${today}.html`,
        content: signedHtml,
        mimeType: "text/html",
      });
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

    // EMAIL → PREVIOUS ACCOUNTANT: professional clearance request
    if (!noPrevAccountant && prevEmail) {
      try {
        await sendMail({
          to: prevEmail,
          toName: prevFirmName || "Previous Accountant",
          subject: `Professional Clearance Request — ${link.companyName} (${link.companyNumber ?? ""})`,
          replyTo: firm.email,
          html: buildClearanceRequestEmail({
            firm,
            clientName: link.companyName ?? "",
            companyNumber: link.companyNumber ?? "",
            directorName: link.directorName ?? "",
            prevFirmName: prevFirmName || "Previous Accountants",
            clearanceUrl,
            today,
            deadline: 14,
            docItems: [],
          }),
        });
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
        await sendMail({
          to: link.clientEmail,
          toName: link.directorName || undefined,
          subject: `Engagement Signed — Welcome to ${firm.legalName}`,
          replyTo: firm.email,
          html: buildClientWelcomeEmail({
            firm,
            companyName: link.companyName ?? "",
            directorName: link.directorName ?? "",
            services: (link.services ?? []) as Array<{ id: string; name: string; price: number }>,
            docUploadUrl,
            today,
          }) .replace(
            "</body>",
            `<div style="text-align:center;padding:0 36px 24px;font-family:Arial,sans-serif">
               <a href="${appUrl}/api/onboarding/links/${token}/letter?signed=1" style="font-size:13px;color:${firm.accentColor};font-weight:600">
                 View / download your signed contract (with signature certificate)
               </a>
             </div></body>`
          ),
        });
      } catch (e) {
        emailErrors.push(`welcome: ${e instanceof Error ? e.message : String(e)}`);
        console.error("Welcome email failed:", e);
      }
    }

    if (emailErrors.length) {
      console.warn("Some emails failed (engagement still accepted):", emailErrors);
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
        : !noPrevAccountant
          ? "Contract signed. Previous accountant notified and firm alerted."
          : "Contract signed. Welcome to the firm.",
    });
  } catch (error) {
    console.error("Error accepting engagement:", error);
    return NextResponse.json({ error: "Failed to accept engagement" }, { status: 500 });
  }
}
