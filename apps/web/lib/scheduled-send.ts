import { sql } from "drizzle-orm";
import { getDb, updateOnboardingLink } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendTemplatedMail } from "@/lib/send-templated-mail";

/**
 * Dispatch any onboarding emails whose scheduled send time has arrived.
 *
 * When staff choose to schedule an engagement/proposal/details email for a
 * future date+time, the link is created immediately but the email is held:
 * `letterMeta.emailPending = true` and `letterMeta.scheduledSendAt = <ISO>`.
 * This function finds every held email that is now due and sends it via the
 * (editable) template for the link's send mode, then clears the pending flag.
 *
 * A failed send is left pending so the next run retries it.
 */
export async function dispatchDueScheduledSends(): Promise<{ due: number; sent: number; failed: number; errors: string[] }> {
  const db = getDb();
  const now = new Date();

  const rows = await db.execute(sql`
    SELECT id, token, company_name, company_number, director_name, client_email,
           firm_slug, expires_at, letter_meta
    FROM onboarding_links
    WHERE status = 'sent'
      AND (letter_meta->>'emailPending') = 'true'
      AND (letter_meta->>'scheduledSendAt') IS NOT NULL
      AND (letter_meta->>'scheduledSendAt')::timestamptz <= ${now.toISOString()}
  `) as unknown as Array<{
    id: string; token: string; company_name: string | null; company_number: string | null;
    director_name: string | null; client_email: string; firm_slug: string | null;
    expires_at: string | Date | null; letter_meta: Record<string, unknown> | null;
  }>;

  let sent = 0, failed = 0;
  const errors: string[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  for (const row of rows) {
    try {
      const meta = (row.letter_meta ?? {}) as Record<string, unknown>;
      const mode = (meta.sendMode as string) ?? "engagement";
      const firm = getFirm(row.firm_slug || "gns");
      const templateKey =
        mode === "details_only" ? "client_details_request"
        : mode === "proposal" || mode === "proposal_only" ? "client_proposal"
        : "client_engagement";
      const engagementUrl = `${appUrl}/onboarding/engage/${row.token}`;
      const expiryStr = row.expires_at
        ? new Date(row.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "";
      const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      const r = await sendTemplatedMail({
        key: templateKey,
        firm,
        token: row.token,
        to: row.client_email,
        toName: row.director_name || undefined,
        replyTo: firm.email,
        actionUrl: engagementUrl,
        vars: {
          directorName: row.director_name || "Director",
          companyName: row.company_name ?? "",
          companyNumber: row.company_number ?? "",
          expiresAt: expiryStr,
          today,
        },
      });

      if (r.ok) {
        const nextMeta = { ...meta, emailPending: false, scheduledEmailSentAt: now.toISOString() };
        await db.transaction((tx) => updateOnboardingLink(tx, row.id, { letterMeta: nextMeta }));
        sent++;
      } else {
        failed++;
        errors.push(`${row.token}: ${r.error ?? "send failed"}`);
      }
    } catch (e) {
      failed++;
      errors.push(`${row.token}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { due: rows.length, sent, failed, errors };
}
