import { sql } from "drizzle-orm";
import { getDb } from "@gns/db";
import { getFirm } from "@/lib/firms";
import { sendMail } from "@/lib/mailer";

/**
 * Weekly partner digest.
 *
 * Emails info@ a one-page summary of the week: new engagements sent, clients
 * signed, monthly revenue won this week, and how many are still awaiting
 * signature — broken down per firm. Intended to run WEEKLY via cPanel cron.
 * Read-only aside from the outbound email; never throws.
 */

type Svc = { name?: string; price?: number; oneoff?: boolean; frequency?: string };
const monthlyOf = (services: Svc[] | null): number =>
  (services ?? []).filter((s) => !s.oneoff).reduce((sum, s) => {
    const p = Number(s.price) || 0;
    return sum + (s.frequency === "annually" ? p / 12 : s.frequency === "quarterly" ? p / 3 : p);
  }, 0);

const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function sendPartnerDigest(): Promise<{ firms: number; sent: number }> {
  const db = getDb();

  const rows = (await db.execute(sql`
    SELECT company_name, director_name, firm_slug, status, sent_at, accepted_at, services
    FROM onboarding_links
    WHERE status IN ('sent', 'accepted')
  `)) as unknown as Array<{
    company_name: string | null; director_name: string | null; firm_slug: string | null;
    status: string; sent_at: string | Date | null; accepted_at: string | Date | null; services: Svc[] | null;
  }>;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const isThisWeek = (d: string | Date | null) => !!d && new Date(d).getTime() >= weekAgo;

  // Aggregate per firm.
  const firms = new Map<string, {
    newSent: number; signed: number; awaiting: number; activeMonthly: number;
    wonMonthly: number; signedList: string[];
  }>();
  const bucket = (slug: string) => {
    let b = firms.get(slug);
    if (!b) { b = { newSent: 0, signed: 0, awaiting: 0, activeMonthly: 0, wonMonthly: 0, signedList: [] }; firms.set(slug, b); }
    return b;
  };

  for (const r of rows) {
    const b = bucket(r.firm_slug || "gns");
    const m = monthlyOf(r.services);
    if (r.status === "sent") b.awaiting += 1;
    if (r.status === "accepted") b.activeMonthly += m;
    if (isThisWeek(r.sent_at)) b.newSent += 1;
    if (r.status === "accepted" && isThisWeek(r.accepted_at)) {
      b.signed += 1; b.wonMonthly += m;
      b.signedList.push(`${r.company_name ?? "Client"}${r.director_name ? ` (${r.director_name})` : ""} — ${gbp(m)}/mo`);
    }
  }

  if (!firms.size) return { firms: 0, sent: 0 };

  const sections = [...firms.entries()].map(([slug, b]) => {
    const firm = getFirm(slug);
    const signedItems = b.signedList.length
      ? `<ul style="margin:6px 0;padding-left:18px">${b.signedList.map((s) => `<li>${s}</li>`).join("")}</ul>`
      : `<p style="color:#6b7280;margin:6px 0">No signings this week.</p>`;
    return `
      <div style="margin:0 0 22px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px">
        <h3 style="margin:0 0 8px;color:#1e3a8a">${firm.name}</h3>
        <table style="font-size:14px;width:100%;border-collapse:collapse">
          <tr><td style="padding:2px 0">New engagements sent (7d)</td><td style="text-align:right"><b>${b.newSent}</b></td></tr>
          <tr><td style="padding:2px 0">Signed this week</td><td style="text-align:right"><b>${b.signed}</b></td></tr>
          <tr><td style="padding:2px 0">Monthly revenue won this week</td><td style="text-align:right"><b>${gbp(b.wonMonthly)}</b></td></tr>
          <tr><td style="padding:2px 0">Awaiting signature</td><td style="text-align:right"><b>${b.awaiting}</b></td></tr>
          <tr><td style="padding:2px 0">Active recurring revenue</td><td style="text-align:right"><b>${gbp(b.activeMonthly)}/mo</b></td></tr>
        </table>
        ${signedItems}
      </div>`;
  }).join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      <h2 style="color:#1e3a8a">GNS weekly digest — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</h2>
      ${sections}
      <p style="color:#9ca3af;font-size:12px">Automated weekly summary from the Compliance Manager.</p>
    </div>`;

  try {
    await sendMail({ to: "info@gnsassociates.co.uk", subject: "GNS weekly digest — onboarding & revenue", html, noGlobalCc: true });
    return { firms: firms.size, sent: 1 };
  } catch (e) {
    console.error("Partner digest send failed:", e);
    return { firms: firms.size, sent: 0 };
  }
}
