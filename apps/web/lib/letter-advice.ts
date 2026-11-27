/**
 * One-off advice letters.
 *
 * Most engagements are ongoing compliance: monthly fees, a Direct Debit, the
 * Self Assessment or Companies Act duties, a scope table. Some are a single
 * piece of advice for a fixed fee, such as reviewing the VAT position of a
 * content creator's income streams. Sending those the ongoing-compliance
 * letter printed an empty "Recurring fees" table, "Payment: Monthly Invoice",
 * "act as accountant for you" and the duties of filing a tax return, none of
 * which applied (modelled on the signed VAT-review letter of 16 Nov 2026).
 *
 * With `adviceMode` on, the letter instead:
 *   - opens with the specific instruction ("to review the VAT position of ...");
 *   - shows one fee table and a total fixed fee, and when it is payable;
 *   - replaces the tax-return / Companies Act sections with the basis of our advice;
 *   - prints the work itself as Schedule A, from the Description of the work box;
 *   - has the client confirm the fixed fee when signing.
 * The terms of business, privacy notice and shared clauses are unchanged.
 *
 * Plain HTML (h2/h3/p/ul/li) so both letter-html.ts and engagement-pdf.ts
 * (through its htmlToBlocks) print exactly the same words. Pure; tested by
 * scripts/test-advice-letter.mts.
 */
import type { CustomFee, LetterService } from "./letter-html";
import { fmtGBP } from "./format";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Paragraphs from a staff-typed box: blank line = new paragraph; escaped. */
function paras(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n  ");
}

export interface AdviceFeeLine {
  name: string;
  price: number;
}

/**
 * Every priced line on an advice letter, whatever frequency it was entered at:
 * an advice engagement has one fixed fee, made up of these lines.
 */
export function adviceFeeLines(services: LetterService[], customFees: CustomFee[] = []): AdviceFeeLine[] {
  return [
    ...services.map((s) => ({ name: s.name, price: s.price || 0 })),
    ...customFees.filter((c) => c.description.trim()).map((c) => ({ name: c.description.trim(), price: c.price || 0 })),
  ];
}

export const adviceTotal = (lines: AdviceFeeLine[]) => lines.reduce((t, l) => t + l.price, 0);

/** The work's name, used for the Schedule A heading: the first fee line, else a neutral title. */
export function adviceTitle(lines: AdviceFeeLine[]): string {
  return lines[0]?.name || "The work we will carry out";
}

/** "review the VAT position of your income streams" → the opening instruction. */
export function adviceIntroHtml(summary: string | undefined): string {
  const what = (summary ?? "").trim().replace(/\.+$/, "");
  return `<p>We are pleased to accept your instruction to ${what ? esc(what) : "carry out the work described in Schedule A"} and are writing to confirm the terms of our appointment.</p>
  <p>The purpose of this letter, together with the attached terms and conditions, is to set out our terms for carrying out the work and to clarify our respective responsibilities.</p>`;
}

/** Payment wording for a fixed fee. */
export function advicePaymentText(total: number): string {
  return `Our fee for this work is a fixed fee of ${fmtGBP(total)} plus VAT, with no additional charges for the work described in Schedule A. We will invoice it when we deliver our advice, and it is payable within 14 days of the invoice date. No Direct Debit mandate is required for this engagement.`;
}

/** Replaces the Self Assessment / Companies Act duties on an advice letter. */
export function adviceBasisHtml(): string {
  return `<h3>Basis of our advice</h3>
  <p>Our advice will be based on the information you give us and on the law and HMRC practice at the date it is given. You are responsible for making sure that information is complete and accurate, and for telling us about anything that may affect our advice.</p>
  <p>We will set out our advice in writing. We will not update it for later changes in the law or in your circumstances unless you ask us to and we agree to do so.</p>
  <p>Unless Schedule A says otherwise, our work does not include preparing or submitting any returns, registrations or other filings. If you would like us to do any of these, we will agree the work and the fee with you before we start.</p>`;
}

/** Schedule A: the work itself, from the Description of the work box. */
export function adviceScheduleHtml(opts: { title: string; description?: string; total: number; regBody: string }): string {
  const body = (opts.description ?? "").trim();
  const site = opts.regBody === "ACCA" ? "www.accaglobal.com" : "www.icaew.com";
  return `<h2>Schedule A — ${esc(opts.title)} (Fixed Fee)</h2>
  ${body ? paras(body) : "<p>The work is as described in this letter.</p>"}
  <p>Our fee for this work is a fixed fee of <strong>${fmtGBP(opts.total)}</strong> plus VAT. There are no additional charges for the work described in this schedule. Work outside this schedule will be agreed with you separately before we start.</p>
  <p>Our services as detailed above are subject to the limitations on our liability set out in the engagement letter. These are important provisions that you should read and consider carefully. We are bound by the ethical guidelines of ${esc(opts.regBody)} (${site}).</p>`;
}

/** Added to the client's confirmation at the signature. */
export function adviceAcceptanceText(total: number): string {
  return `I/We agree to the fixed fee of ${fmtGBP(total)} plus VAT for the work described in Schedule A.`;
}
