/**
 * Staff-only escape hatch for a client stuck in "pending_dd".
 *
 * The Direct Debit gate finalises a client's engagement when GoCardless sends
 * a mandates.active webhook. If that webhook never arrives — endpoint wasn't
 * configured yet, the signing secret was missing when it fired, GoCardless
 * exhausted its retries, the mandate was activated manually in the dashboard —
 * the client would otherwise sit in pending_dd indefinitely with no way out.
 *
 * This completes the acceptance exactly as the webhook would: flips the link to
 * "accepted", masks the stored bank details, and runs the deferred side-effects
 * (clearance emails, welcome email, signed-PDF archive) via the same shared
 * runPostAcceptanceEffects() the webhook uses, so the outcome is identical.
 *
 * Staff should confirm the mandate really is active in the GoCardless dashboard
 * before using this — it is an override of a payment gate, so the reason is
 * recorded on the acceptance record.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { runPostAcceptanceEffects, type PostAcceptanceContext, type PostAcceptanceMeta } from "@/lib/post-acceptance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (link.status === "accepted") {
    return NextResponse.json({ error: "This engagement is already complete." }, { status: 409 });
  }
  if (link.status !== "pending_dd") {
    return NextResponse.json(
      { error: `Only a client awaiting Direct Debit confirmation can be completed this way (this one is "${link.status}").` },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({})) as { reason?: string };
  const now = new Date();
  const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
  const gc = (acc.gocardless ?? {}) as Record<string, unknown>;
  const audit = (acc.audit ?? {}) as Record<string, unknown>;
  const dd = (acc.directDebit ?? null) as { accountName?: string; accountNumber?: string; sortCode?: string } | null;
  const cleanAccountNo = (dd?.accountNumber ?? "").replace(/\D/g, "");
  const cleanSortCode = (dd?.sortCode ?? "").replace(/\D/g, "");

  // Same masking the webhook applies — GoCardless holds the mandate now, so the
  // raw account number and sort code are no longer needed on our side.
  const maskedDd = dd
    ? {
        accountName: dd.accountName ?? null,
        accountNumber: cleanAccountNo ? `****${cleanAccountNo.slice(-4)}` : null,
        sortCode: cleanSortCode ? `${cleanSortCode.slice(0, 2)}-**-**` : null,
        purgedAt: now.toISOString(),
      }
    : null;

  await db.transaction((tx) =>
    updateOnboardingLink(tx, link.id, {
      status: "accepted",
      acceptedAt: now,
      acceptanceData: {
        ...acc,
        directDebit: maskedDd,
        gocardless: {
          ...gc,
          mandateStatus: "active",
          mandateActiveAt: now.toISOString(),
          // Audit: this was a human override, not a GoCardless confirmation.
          completedManuallyBy: session.displayName ?? session.userId,
          completedManuallyAt: now.toISOString(),
          completedManuallyReason: body.reason?.trim() || null,
        },
      },
    })
  );

  const firm = getFirm(link.firmSlug || "gns");
  const meta = (link.letterMeta ?? {}) as PostAcceptanceMeta & Record<string, unknown>;
  const ctx: PostAcceptanceContext = {
    link: { ...link, letterMeta: (link.letterMeta ?? {}) as Record<string, unknown> },
    token: link.token,
    mode: "engagement",
    firm,
    meta,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    today: now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    now,
    signatureName: (acc.signatureName as string) || link.directorName || "",
    contactPrefs: (acc.contactPrefs as string[]) ?? [],
    directorDocs: (acc.directorDocs as Array<{ id: string; label: string; status: string }>) ?? [],
    companyDocs: (acc.companyDocs as Array<{ id: string; label: string; status: string }>) ?? [],
    prevFirmName: link.prevAccountantFirmName,
    prevEmail: link.prevAccountantEmail,
    prevPhone: (acc.prevPhone as string) ?? null,
    noPrevAccountant: !link.prevAccountantEmail,
    ipAddress: (audit.ipAddress as string) ?? "unknown",
    userAgent: (audit.userAgent as string) ?? "unknown",
    documentSha256: audit.documentSha256 as string | undefined,
    ddSummary: maskedDd?.accountName
      ? `${maskedDd.accountName} · ${maskedDd.accountNumber ?? ""} · ${maskedDd.sortCode ?? ""}`
      : null,
    signedHtml: link.signedHtml,
  };

  try {
    await runPostAcceptanceEffects(ctx);
  } catch (e) {
    // The status flip already happened and is the important part; the effects
    // log their own failures individually and are safe to re-run.
    console.error("force-complete: post-acceptance effects failed:", e);
  }

  return NextResponse.json({ success: true, status: "accepted" });
}
