/**
 * "Draft reply": a reply to the lead, written and saved in the Outlook Drafts
 * of the person who pressed the button. Never sent from here: a person reads
 * it, changes what they like, and presses Send in Outlook.
 *
 * For an Instant Fee Quote enquiry the quote is first checked against today's
 * website prices (quote-rules.ts) and the reply uses today's figures; any
 * line that changed is shown to staff on screen, never in the email. For any
 * other enquiry the reply thanks them, quotes what they asked, and leaves a
 * marked space for the answer.
 *
 * Saving to Outlook needs the Graph application permission Mail.ReadWrite.
 * Without it the draft is still shown, with a copy button and a mailto link.
 */
import "server-only";
import { getDb } from "@gns/db";
import { sql } from "drizzle-orm";
import { getGraphToken } from "./onedrive";
import { FIRMS } from "./firms";
import type { Lead } from "./lead-store";
import { checkQuote, isQuoteSummary, withVat, perMonth, type QuoteCheck } from "./quote-rules";
import { domainOf } from "./lead-mail-match";

export interface DraftResult {
  check: QuoteCheck;
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

/** The website quote, wherever the form put it: the message box or an extra field. */
export function quoteTextOf(lead: Pick<Lead, "message" | "extra">): string | null {
  if (isQuoteSummary(lead.message)) return lead.message;
  return lead.extra.map((x) => x.value).find((v) => isQuoteSummary(v)) ?? null;
}

function firstName(name: string | null): string {
  const n = (name ?? "").trim().split(/\s+/)[0] ?? "";
  // "Mr" is a title, not a name; fall back to a neutral greeting.
  return n && !/^(mr|mrs|ms|miss|dr)\.?$/i.test(n) ? n : "";
}

export function composeDraft(lead: Lead, staffName: string | null): DraftResult {
  const firm = FIRMS[lead.firmSlug ?? "gns"] ?? FIRMS.gns!;
  const hello = firstName(lead.name) ? `Dear ${firstName(lead.name)},` : "Dear Sir or Madam,";
  const sign = [staffName, firm.name].filter((s): s is string => Boolean(s));
  const quote = quoteTextOf(lead);
  const check = checkQuote(quote);

  const p: string[] = [];
  const t: string[] = [];
  const para = (html: string, text: string) => { p.push(`<p>${html}</p>`); t.push(text); };
  para(esc(hello), hello);

  let subject: string;
  if (check.found && !check.customQuote && check.lines.length) {
    subject = `Your quote from ${firm.name}`;
    para("Thank you for using our instant fee quote. Based on the details you gave us, our fees would be:",
      "Thank you for using our instant fee quote. Based on the details you gave us, our fees would be:");
    const rows = check.lines.map((l) => {
      const price = l.current ?? l.quoted;
      return { html: `<tr><td style="padding:4px 12px 4px 0">${esc(l.label)}</td><td style="padding:4px 0;text-align:right">${gbp(price)}</td></tr>`, text: `  ${l.label}: ${gbp(price)}` };
    });
    const total = check.currentTotal;
    p.push(`<table style="border-collapse:collapse;font-size:14px">${rows.map((r) => r.html).join("")}` +
      `<tr><td style="padding:8px 12px 4px 0;border-top:1px solid #ccc"><b>Total per year (excl. VAT)</b></td><td style="padding:8px 0 4px;border-top:1px solid #ccc;text-align:right"><b>${gbp(total)}</b></td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0">Including 20% VAT</td><td style="padding:4px 0;text-align:right">${gbp(withVat(total))}</td></tr></table>`);
    t.push(...rows.map((r) => r.text), `  Total per year (excl. VAT): ${gbp(total)}`, `  Including 20% VAT: ${gbp(withVat(total))}`);
    para(`That is about <b>${gbp(perMonth(total))} a month plus VAT</b>, collected by Direct Debit, so there are no large bills at year end.`,
      `That is about ${gbp(perMonth(total))} a month plus VAT, collected by Direct Debit, so there are no large bills at year end.`);
    para("If you would like to go ahead, just reply to this email and we will send your engagement letter to sign online. We then take care of the handover from your current accountant.",
      "If you would like to go ahead, just reply to this email and we will send your engagement letter to sign online. We then take care of the handover from your current accountant.");
    para("If anything has changed, or you would like to talk it through first, reply with a time that suits you and we will call you.",
      "If anything has changed, or you would like to talk it through first, reply with a time that suits you and we will call you.");
  } else {
    subject = `Your enquiry to ${firm.name}`;
    para("Thank you for getting in touch with us.", "Thank you for getting in touch with us.");
    const asked = (check.customQuote ? "a quote for a business with turnover over £10 million" : lead.message ?? lead.services ?? "").trim();
    if (asked) {
      const short = asked.length > 600 ? asked.slice(0, 600).trimEnd() + "…" : asked;
      p.push(`<blockquote style="margin:0 0 12px;padding:8px 12px;border-left:3px solid #ccc;color:#555">${esc(short).replace(/\n/g, "<br>")}</blockquote>`);
      t.push(`> ${short.replace(/\n/g, "\n> ")}`);
    }
    para(`<span style="background:#fff3bf">[Your answer here: delete this line before sending.]</span>`, "[Your answer here: delete this line before sending.]");
    para(`You can also get an instant fee estimate at <a href="https://www.gnsassociates.co.uk/instant-fee-quote/">gnsassociates.co.uk/instant-fee-quote</a>, or reply with a convenient time and we will call you.`,
      "You can also get an instant fee estimate at https://www.gnsassociates.co.uk/instant-fee-quote/ , or reply with a convenient time and we will call you.");
  }

  para("Kind regards,<br>" + sign.map(esc).join("<br>"), "Kind regards,\n" + sign.join("\n"));
  return {
    check,
    subject,
    html: `<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.45">${p.join("")}</div>`,
    text: t.join("\n\n"),
  };
}

/** The staff member's own mailbox if it is a GNS one; otherwise info@. */
export async function draftMailboxFor(userId: string): Promise<string> {
  const fallback = (process.env.MAIL_FROM_EMAIL ?? "info@gnsassociates.co.uk").toLowerCase();
  const ours = new Set([domainOf(fallback), ...(process.env.LEADS_MAIL_DOMAINS ?? "gnsassociates.co.uk,gnsuk.com").split(",").map((s) => s.trim().toLowerCase())]);
  try {
    const rows = (await getDb().execute(sql`SELECT lower(email) AS email FROM users WHERE id = ${userId}::uuid`)) as unknown as Array<{ email: string }>;
    const e = rows[0]?.email;
    if (e && ours.has(domainOf(e))) return e;
  } catch { /* fall back to info@ */ }
  return fallback;
}

export type SaveResult =
  | { saved: true; mailbox: string; webLink: string | null }
  | { saved: false; mailbox: string; reason: "not_configured" | "not_granted" | "error"; detail?: string };

/** Put the draft in that mailbox's Drafts folder. Nothing is sent. */
export async function saveOutlookDraft(mailbox: string, to: { email: string; name: string | null }, d: DraftResult): Promise<SaveResult> {
  const token = await getGraphToken();
  if (!token) return { saved: false, mailbox, reason: "not_configured" };
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: d.subject,
        body: { contentType: "HTML", content: d.html },
        toRecipients: [{ emailAddress: { address: to.email, ...(to.name ? { name: to.name } : {}) } }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 201) {
      const j = (await res.json().catch(() => ({}))) as { webLink?: string };
      return { saved: true, mailbox, webLink: j.webLink ?? null };
    }
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) return { saved: false, mailbox, reason: "not_granted", detail: body.slice(0, 200) };
    return { saved: false, mailbox, reason: "error", detail: `Graph ${res.status}: ${body.slice(0, 200)}` };
  } catch (e) {
    return { saved: false, mailbox, reason: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}
