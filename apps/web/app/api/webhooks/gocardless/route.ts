/**
 * GoCardless webhook receiver.
 *
 * Mandate creation (lib/gocardless.ts) is synchronous but only ever returns a
 * mandate in "pending_submission" — the bank has not yet confirmed anything.
 * Clients whose engagement is gated on Direct Debit are therefore parked in
 * status "pending_dd" by the accept route, and it is THIS endpoint that
 * finalises them: when GoCardless reports the mandate is active, the link
 * flips to "accepted" and all the deferred side-effects (clearance emails,
 * welcome email, signed-PDF archive) run via runPostAcceptanceEffects().
 *
 * Setup: in each firm's GoCardless dashboard → Developers → Webhook endpoints,
 * point a new endpoint at  {APP_URL}/api/webhooks/gocardless  and copy its
 * signing secret into GOCARDLESS_WEBHOOK_SECRET (or the per-firm
 * GOCARDLESS_WEBHOOK_SECRET_<FIRM> variant). Without a secret configured every
 * request is rejected, since an unverified webhook must never be trusted to
 * advance a client's contract state.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByMandateId, updateOnboardingLink } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { verifyGoCardlessWebhookSignature } from "@/lib/gocardless";
import { runPostAcceptanceEffects, type PostAcceptanceContext, type PostAcceptanceMeta } from "@/lib/post-acceptance";

export const dynamic = "force-dynamic";

interface GcEvent {
  id?: string;
  resource_type?: string;
  action?: string;
  links?: { mandate?: string };
  details?: { cause?: string; description?: string };
}

// Mandate actions that mean "this mandate will never become usable". Anything
// else that isn't an activation is simply informational and left alone.
const FAILURE_ACTIONS = new Set(["failed", "cancelled", "expired"]);

export async function POST(req: NextRequest) {
  // Signature is computed over the RAW body — read it as text, never as JSON,
  // or re-serialisation differences would break verification.
  const rawBody = await req.text();
  if (!verifyGoCardlessWebhookSignature(rawBody, req.headers.get("webhook-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: GcEvent[] = [];
  try {
    events = (JSON.parse(rawBody) as { events?: GcEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const db = getDb();

  for (const ev of events) {
    if (ev.resource_type !== "mandates") continue;
    const mandateId = ev.links?.mandate;
    if (!mandateId) continue;

    const isActive = ev.action === "active";
    const isFailure = FAILURE_ACTIONS.has(ev.action ?? "");
    if (!isActive && !isFailure) continue;

    try {
      const link = await db.transaction((tx) => getOnboardingLinkByMandateId(tx, mandateId));
      // Not one of ours, or a mandate for a client who was never gated on DD.
      if (!link || link.status !== "pending_dd") continue;

      const acc = (link.acceptanceData ?? {}) as Record<string, unknown>;
      const gc = (acc.gocardless ?? {}) as Record<string, unknown>;

      if (isFailure) {
        // Leave the client in pending_dd (their signature stands, but the
        // contract is not finalised) and record why, so staff can chase or use
        // the existing gocardless-retry endpoint with corrected bank details.
        await db.transaction((tx) =>
          updateOnboardingLink(tx, link.id, {
            acceptanceData: {
              ...acc,
              gocardless: {
                ...gc,
                mandateStatus: ev.action,
                mandateFailedAt: new Date().toISOString(),
                mandateFailureReason: ev.details?.description ?? ev.details?.cause ?? null,
              },
            },
          })
        );
        continue;
      }

      // ── Mandate is active → finalise the acceptance ──────────────────────
      const now = new Date();
      const meta = (link.letterMeta ?? {}) as PostAcceptanceMeta & Record<string, unknown>;
      const firm = getFirm(link.firmSlug || "gns");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const audit = (acc.audit ?? {}) as Record<string, unknown>;
      const dd = (acc.directDebit ?? null) as { accountName?: string; accountNumber?: string; sortCode?: string } | null;
      const cleanAccountNo = (dd?.accountNumber ?? "").replace(/\D/g, "");
      const cleanSortCode = (dd?.sortCode ?? "").replace(/\D/g, "");

      await db.transaction((tx) =>
        updateOnboardingLink(tx, link.id, {
          status: "accepted",
          acceptedAt: now,
          acceptanceData: {
            ...acc,
            gocardless: { ...gc, mandateStatus: "active", mandateActiveAt: now.toISOString() },
          },
        })
      );

      const ctx: PostAcceptanceContext = {
        link: { ...link, letterMeta: (link.letterMeta ?? {}) as Record<string, unknown> },
        token: link.token,
        mode: "engagement", // only engagement-mode acceptances are ever DD-gated
        firm,
        meta,
        appUrl,
        today,
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
        ddSummary: dd?.accountName
          ? `${dd.accountName} · ****${cleanAccountNo.slice(-4)} · ${cleanSortCode.slice(0, 2)}-**-**`
          : null,
        signedHtml: link.signedHtml,
      };
      await runPostAcceptanceEffects(ctx);
    } catch (e) {
      // Never 500 back to GoCardless for one bad event — that would make it
      // retry the whole batch, including events already processed. Log and
      // move on; the admin gocardless-process-pending job is the backstop.
      console.error(`GoCardless webhook: failed handling event ${ev.id ?? "?"} (${ev.action}):`, e);
    }
  }

  return NextResponse.json({ received: true });
}
