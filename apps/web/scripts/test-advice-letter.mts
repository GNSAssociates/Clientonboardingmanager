/**
 * One-off advice letters (lib/letter-advice.ts), modelled on the signed VAT
 * position review letter: an individual, one fixed fee, the work as Schedule A.
 * And that an ordinary letter is untouched by the change.
 *
 *   node_modules/.bin/tsx scripts/test-advice-letter.mts
 */
import { FIRMS } from "../lib/firms";
import { buildLetterHtml, nonCompanyDutiesHtml, type LetterData } from "../lib/letter-html";
import { adviceFeeLines, adviceTotal, adviceTitle, adviceIntroHtml } from "../lib/letter-advice";

let pass = 0;
const failures: string[] = [];
const check = (label: string, ok: boolean) => { if (ok) pass++; else failures.push(label); };
const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const advice: LetterData = {
  firm: FIRMS.gns!,
  companyName: "Sample Client",
  clientName: "Sample Client",
  clientType: "individual",
  clientAddress: "1 Sample Street, Bolton",
  services: [],
  customFees: [{ description: "VAT position review - all income streams", price: 495, frequency: "one-off" }],
  paymentMethod: "manual",
  workDescription: "You have instructed us to review the VAT position of all of your income as a content creator.\n\nFollowing delivery of our written advice, we will hold one 30-minute follow-up call with you.",
  adviceMode: true,
  adviceSummary: "review the VAT position of your income streams",
  dateStr: "27 November 2026",
};

// --- 1. Fee lines and total.
{
  const lines = adviceFeeLines([], [{ description: "Review", price: 300, frequency: "monthly" }, { description: "Call", price: 50 }, { description: "  ", price: 99 }]);
  check("monthly-entered fee still counted once", adviceTotal(lines) === 350);
  check("blank fee lines dropped", lines.length === 2);
  check("title from first fee line", adviceTitle(lines) === "Review");
  check("neutral title when there are no lines", adviceTitle([]) === "The work we will carry out");
  check("intro trims a trailing full stop", adviceIntroHtml("review the VAT position.").includes("instruction to review the VAT position and are writing"));
  check("intro escapes", !adviceIntroHtml("<b>x</b>").includes("<b>"));
}

// --- 2. The advice letter itself.
{
  const html = buildLetterHtml(advice);
  const t = text(html);
  check("opens with the instruction", t.includes("We are pleased to accept your instruction to review the VAT position of your income streams"));
  check("not 'act as accountant'", !t.includes("act as accountant"));
  check("fee line printed", t.includes("VAT position review - all income streams £495.00+VAT"));
  check("total fixed fee", t.includes("Total fixed fee £495.00+VAT"));
  check("no recurring fees table", !t.includes("Recurring Fees Agreed") && !t.includes("Total recurring fees"));
  check("no monthly invoice wording", !t.includes("Monthly Invoice") && !t.includes("invoiced monthly"));
  check("payment wording", t.includes("fixed fee of £495.00 plus VAT") && t.includes("payable within 14 days"));
  check("no scope-of-services coverage table", !t.includes("Coverage Threshold"));
  check("scope points to Schedule A", t.includes("are set out in Schedule A"));
  check("basis of our advice", t.includes("Basis of our advice") && t.includes("law and HMRC practice at the date it is given"));
  check("no Self Assessment duties", !t.includes("Your statutory responsibilities") && !t.includes("prepare your Self Assessment tax return"));
  check("no Companies Act duties", !t.includes("Companies Act 2006"));
  check("Schedule A titled from the fee", t.includes("Schedule A — VAT position review - all income streams (Fixed Fee)"));
  check("Schedule A carries the description", t.includes("review the VAT position of all of your income as a content creator") && t.includes("one 30-minute follow-up call"));
  check("generic ad-hoc schedule not printed", !t.includes("Ad-hoc, Catch-up and One-off Services"));
  check("acceptance confirms the fixed fee", t.includes("I/We agree to the fixed fee of £495.00 plus VAT for the work described in Schedule A."));
  check("no Annex A", !t.includes("Annex A: Schedule of Service Charges"));
  check("description not printed twice", (t.match(/30-minute follow-up call/g) ?? []).length === 1);
  check("terms of business kept", t.includes("TERMS OF BUSINESS"));
  check("privacy notice kept", t.includes("PRIVACY NOTICE"));
  check("shared clauses kept", t.includes("Who will carry out the work") && t.includes("Identity checks"));
}

// --- 3. Advice mode off: the ordinary letter is unchanged.
{
  const ordinary = text(buildLetterHtml({ ...advice, adviceMode: false }));
  check("ordinary: accountant intro", ordinary.includes("act as accountant"));
  check("ordinary: recurring fees table", ordinary.includes("Recurring Fees Agreed"));
  check("ordinary: SA duties for an individual", ordinary.includes("Your statutory responsibilities"));
  check("ordinary: no fixed-fee acceptance", !ordinary.includes("I/We agree to the fixed fee"));
}

// --- 4. The duties helper is what the letter prints.
{
  check("landlord records wording", nonCompanyDutiesHtml("btl").includes("rental income and allowable expenses for each let property"));
  check("sole trader records wording", nonCompanyDutiesHtml("sole_trader").includes("business income and expenses"));
  check("partnership extra paragraph", nonCompanyDutiesHtml("partnership").includes("each partner remains personally responsible"));
  const st = buildLetterHtml({ ...advice, adviceMode: false, clientType: "sole_trader" });
  check("letter uses the helper", st.includes("business income and expenses"));
}

// --- 5. The PDF builds for advice and non-company letters.
{
  const { buildEngagementPdf } = await import("../lib/engagement-pdf");
  const { PDFDocument } = await import("pdf-lib");
  for (const [label, data] of [["advice", advice], ["sole trader", { ...advice, adviceMode: false, clientType: "sole_trader" }], ["limited", { ...advice, adviceMode: false, clientType: "limited" }]] as const) {
    const pdf = await buildEngagementPdf(data as LetterData);
    check(`PDF builds: ${label}`, (await PDFDocument.load(pdf)).getPageCount() > 0);
  }
  // The Companies Act block is long: a sole trader's PDF (now without it) must be shorter than a company's.
  const st = await buildEngagementPdf({ ...advice, adviceMode: false, clientType: "sole_trader" });
  const ltd = await buildEngagementPdf({ ...advice, adviceMode: false, clientType: "limited" });
  check("PDF: sole trader no longer gets the Companies Act block", st.length < ltd.length);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log("  FAIL  " + f));
  process.exit(1);
}
