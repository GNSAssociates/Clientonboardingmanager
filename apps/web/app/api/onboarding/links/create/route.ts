import { NextRequest, NextResponse } from "next/server";
import { getDb, createOnboardingLink, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { randomBytes } from "crypto";
import { getFirm } from "@/lib/firms";
import { sendTemplatedMail } from "@/lib/send-templated-mail";
import { buildLetterHtml, type LetterService, type CustomFee, type ScopeRow, type ChDetails } from "@/lib/letter-html";
import { archiveToClientFolder } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // PDF archive render on send

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firmSlug,
      entityId,
      companyName,
      companyNumber,
      companyAddress,
      directorName,
      directorEmail,
      serviceDetails,
      // Letter engine options
      partnerName,
      sendMode, // 'engagement' | 'details_only' | 'proposal'
      regBody,  // 'ACCA' | 'ICAEW' — chosen letter body
      customFees,
      scopeRows,
      ch,
      draftToken, // when present, promote this in-progress draft instead of inserting a new row
      scheduledSendAt, // ISO datetime — when set to the future, hold the email until then
      // Wizard toggles + client-type data — must flow into letterMeta so the
      // letter and the engage page honour them.
      paymentMethod,   // 'dd' | 'manual'
      includeAnnexA,   // bool — include the SSC annex
      clientType,      // limited | sole_trader | btl | partnership | llp | individual
      clientName,      // business / trading / client name (non-company types)
      businessAddress, // registered/correspondence address (non-company types)
      utr,             // Unique Taxpayer Reference
      oneoffScopes,    // { [oneoffId]: scope-of-work text }
    } = body as {
      firmSlug?: string; entityId?: string; companyName?: string; companyNumber?: string;
      companyAddress?: string; directorName?: string; directorEmail?: string;
      serviceDetails?: LetterService[];
      partnerName?: string; sendMode?: string; regBody?: string;
      customFees?: CustomFee[]; scopeRows?: ScopeRow[]; ch?: ChDetails | null;
      draftToken?: string; scheduledSendAt?: string;
      paymentMethod?: string; includeAnnexA?: boolean; clientType?: string;
      clientName?: string; businessAddress?: string; utr?: string;
      oneoffScopes?: Record<string, string>;
    };

    if (!firmSlug || !companyName || !directorEmail) {
      return NextResponse.json(
        { error: "Missing required fields: firmSlug, companyName, directorEmail" },
        { status: 400 }
      );
    }

    const db = getDb();
    // Modes:
    //  engagement    — signable engagement letter
    //  proposal      — same signable letter, framed with a proposal covering note
    //  proposal_only — proposal document for review & light approval (no Direct
    //                  Debit, no e-signature, no clearance); engagement sent later
    //  details_only  — collects previous-accountant details, no contract
    const VALID = ["engagement", "proposal", "proposal_only", "details_only"];
    const mode = VALID.includes(sendMode ?? "") ? (sendMode as string) : "engagement";
    const showsLetter = mode === "engagement" || mode === "proposal" || mode === "proposal_only";
    const isProposalMode = mode === "proposal" || mode === "proposal_only";
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const resolvedEntityId = entityId && /^[0-9a-f-]{36}$/i.test(entityId) ? entityId : null;

    // If this send is promoting a saved wizard draft, reuse its row + token so
    // progress is not duplicated and the dashboard entry transitions in-place.
    const existingDraft = draftToken
      ? await db.transaction((tx) => getOnboardingLinkByToken(tx, draftToken))
      : null;
    const promoteDraft = !!existingDraft && existingDraft.status === "draft";
    const token = promoteDraft ? existingDraft!.token : randomBytes(32).toString("hex");

    const firm = getFirm(firmSlug);
    const letterRegBody = regBody === "ICAEW" || regBody === "ACCA" ? regBody : firm.regBody;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // Scheduling: if a valid future time is given, hold the email and let the
    // scheduled-send dispatcher deliver it when due (details_only has no letter
    // but can still be scheduled).
    const schedDate = scheduledSendAt ? new Date(scheduledSendAt) : null;
    const isScheduled = !!schedDate && !isNaN(schedDate.getTime()) && schedDate.getTime() > Date.now() + 60_000;

    const letterMeta: {
      sendMode: string; regBody: string; partnerName: string;
      customFees: CustomFee[]; scopeRows: ScopeRow[] | null;
      clientAddress: string; ch: ChDetails | null;
      paymentMethod: string; includeAnnexA: boolean; clientType: string;
      clientName?: string; utr?: string; oneoffScopes?: Record<string, string>;
      scheduledSendAt?: string; emailPending?: boolean;
    } = {
      sendMode: mode,
      regBody: letterRegBody,
      partnerName: partnerName || firm.partnerName,
      customFees: customFees ?? [],
      scopeRows: scopeRows ?? null,
      clientAddress: businessAddress || companyAddress || ch?.address || "",
      ch: ch ?? null,
      paymentMethod: paymentMethod === "manual" ? "manual" : "dd",
      includeAnnexA: includeAnnexA !== false,
      clientType: clientType || "limited",
      ...(clientName ? { clientName } : {}),
      ...(utr ? { utr } : {}),
      ...(oneoffScopes && Object.keys(oneoffScopes).length ? { oneoffScopes } : {}),
      ...(isScheduled ? { scheduledSendAt: schedDate!.toISOString(), emailPending: true } : {}),
    };

    // Snapshot the letter exactly as issued (letter-bearing modes)
    let letterHtml: string | null = null;
    if (showsLetter) {
      letterHtml = buildLetterHtml({
        firm,
        regBody: letterRegBody,
        companyName,
        companyNumber,
        clientAddress: letterMeta.clientAddress,
        directorName,
        partnerName: letterMeta.partnerName,
        services: serviceDetails ?? [],
        customFees: customFees ?? [],
        scopeRows: scopeRows ?? undefined,
        ch: ch ?? null,
        dateStr: today,
        appUrl,
        paymentMethod: letterMeta.paymentMethod,
        includeAnnexA: letterMeta.includeAnnexA,
        clientType: letterMeta.clientType,
        clientName: letterMeta.clientName,
        utr: letterMeta.utr,
      });
    }

    const linkValues = {
      entityId: resolvedEntityId,
      token,
      companyNumber,
      companyName,
      clientEmail: directorEmail,
      directorName,
      directorEmail,
      firmSlug,
      services: (serviceDetails || []).map((s) => ({ ...s, id: s.id ?? s.name })),
      status: "sent" as const,
      sentAt: new Date(),
      expiresAt,
      resendCount: "0",
      letterMeta,
      letterHtml,
    };

    const link = promoteDraft
      ? (await db.transaction((tx) => updateOnboardingLink(tx, existingDraft!.id, linkValues)))!
      : await db.transaction((tx) => createOnboardingLink(tx, linkValues));

    // Archive the SENT letter to OneDrive (folder = client name) as a proper PDF
    // — non-fatal, no-op until storage is configured. Proposal-only saves as a
    // "Proposal"; engagement/proposal save as "Engagement Letter".
    let archivePath: string | null = null;
    if (showsLetter) {
      try {
        const { renderLetterPdf } = await import("@/lib/letter-pdf");
        const pdf = await renderLetterPdf({
          firm, regBody: letterRegBody, companyName, companyNumber,
          clientAddress: letterMeta.clientAddress, directorName,
          partnerName: letterMeta.partnerName, services: serviceDetails ?? [],
          customFees: customFees ?? [], scopeRows: scopeRows ?? undefined,
          ch: ch ?? null, dateStr: today,
          paymentMethod: letterMeta.paymentMethod,
          includeAnnexA: letterMeta.includeAnnexA,
          clientType: letterMeta.clientType,
          clientName: letterMeta.clientName,
          utr: letterMeta.utr,
        });
        const docLabel = mode === "proposal_only" ? "Proposal" : "Engagement Letter";
        const archived = await archiveToClientFolder({
          companyName,
          fileName: `${docLabel} - ${companyName} - ${today}.pdf`,
          content: pdf,
          mimeType: "application/pdf",
        });
        archivePath = archived ? `${archived.provider}:${archived.path}` : null;
      } catch (e) {
        console.error("Archive PDF render failed (non-fatal):", e instanceof Error ? e.message : e);
      }
    }

    const engagementUrl = `${appUrl}/onboarding/engage/${token}`;
    const expiryStr = expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // Send the client email using the (editable) template for this mode.
    // Failure is non-fatal — the link is still created. When scheduled, the
    // email is held and the scheduled-send dispatcher delivers it when due.
    const templateKey =
      mode === "details_only" ? "client_details_request"
      : isProposalMode ? "client_proposal"
      : "client_engagement";
    let emailSent = false;
    if (!isScheduled) {
      try {
        const r = await sendTemplatedMail({
          key: templateKey,
          firm,
          token,
          to: directorEmail,
          toName: directorName || undefined,
          replyTo: firm.email,
          actionUrl: engagementUrl,
          vars: {
            directorName: directorName || "Director",
            companyName,
            companyNumber: companyNumber ?? "",
            expiresAt: expiryStr,
            today,
          },
        });
        emailSent = r.ok;
        if (!r.ok) console.error("Templated email not sent:", r.error);
      } catch (emailErr) {
        console.error("Email send failed (link still created):", emailErr instanceof Error ? emailErr.message : emailErr);
      }
    }

    console.log(`✓ Onboarding link created (${mode}): ${engagementUrl} | email sent: ${emailSent} | archive: ${archivePath ?? "off"}`);

    return NextResponse.json({
      success: true,
      token,
      linkId: link.id,
      mode,
      engagementUrl: `/onboarding/engage/${token}`,
      expiresAt: expiresAt.toISOString(),
      emailSent,
      scheduledSendAt: isScheduled ? schedDate!.toISOString() : null,
      archivePath,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error creating onboarding link:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
