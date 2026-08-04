import { sql } from "drizzle-orm";
import { getDb } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";

/**
 * Annual re-engagement reminders.
 *
 * Finds every signed engagement (status 'accepted') that reached ~11 months
 * since acceptance in the last 7 days, and emails the firm a digest of clients
 * due for annual re-engagement. Intended to run WEEKLY: the 7-day window means
 * each engagement is reported exactly once, so no "reminded" flag is needed and
 * nothing is ever sent to the client automatically — it only prompts staff to
 * issue a fresh letter for the coming year. Never throws.
 */
export async function sendRenewalReminders(): Promise<{ due: number; sent: number }> {
  const db = getDb();

  const rows = (await db.execute(sql`
    SELECT id, token, company_name, company_number, director_name, client_email,
           firm_slug, accepted_at
    FROM onboarding_links
    WHERE status = 'accepted'
      AND accepted_at IS NOT NULL
      AND accepted_at <= now() - interval '11 months'
      AND accepted_at >  now() - interval '11 months' - interval '7 days'
    ORDER BY firm_slug, accepted_at
  `)) as unknown as Array<{
    id: string; token: string; company_name: string | null; company_number: string | null;
    director_name: string | null; client_email: string | null; firm_slug: string | null;
    accepted_at: string | Date | null;
  }>;

  if (!rows.length) return { due: 0, sent: 0 };

  // Group the due engagements by firm so each partner gets one digest.
  const byFirm = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.firm_slug || "gns";
    const list = byFirm.get(key);
    if (list) list.push(r);
    else byFirm.set(key, [r]);
  }

  let sent = 0;
  for (const [slug, list] of byFirm) {
    const firm = getFirm(slug);
    const items = list.map((r) => {
      const signed = r.accepted_at
        ? new Date(r.accepted_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "";
      const parts = [
        `<b>${r.company_name ?? "Client"}</b>${r.company_number ? ` (No. ${r.company_number})` : ""}`,
        signed && `signed ${signed}`,
        r.director_name || undefined,
        r.client_email || undefined,
      ].filter(Boolean);
      return `<li style="margin:6px 0">${parts.join(" &middot; ")}</li>`;
    }).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
        <h2 style="color:#1e3a8a;margin:0 0 6px">Annual re-engagement due &mdash; ${firm.name}</h2>
        <p style="font-size:14px">The following ${list.length > 1 ? "clients have" : "client has"} reached about
        11 months since signing and ${list.length > 1 ? "are" : "is"} due for annual re-engagement:</p>
        <ul style="font-size:14px;padding-left:18px">${items}</ul>
        <p style="color:#6b7280;font-size:13px">Please review and issue a fresh engagement letter for the coming year.</p>
      </div>`;

    try {
      await sendMail({
        to: firm.email || "info@gnsassociates.co.uk",
        subject: `Annual re-engagement due — ${list.length} client${list.length > 1 ? "s" : ""} (${firm.name})`,
        html,
      });
      sent++;
    } catch (e) {
      console.error("Renewal reminder send failed for firm", slug, e);
    }
  }

  return { due: rows.length, sent };
}
