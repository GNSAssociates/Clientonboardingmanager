/**
 * The special-terms clause: that it renders, that it is escaped, and that it
 * appears in both the HTML letter and the PDF.
 *
 *   node_modules/.bin/tsx scripts/test-special-terms.mts
 */
import { PDFDocument } from "pdf-lib";
import { FIRMS } from "../lib/firms";
import { buildLetterHtml, type LetterData } from "../lib/letter-html";

let pass = 0;
const failures: string[] = [];
const check = (label: string, actual: unknown, expected: unknown) => {
  if (actual === expected) pass++;
  else failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const base: LetterData = {
  firm: FIRMS.gns!,
  companyName: "Trial Ltd",
  companyNumber: "12345678",
  clientAddress: "42 Example Street, London, W1A 1AA",
  directorName: "Jane Smith",
  services: [{ id: "annual_accounts", name: "Annual Accounts", price: 100, oneoff: false }],
  customFees: [],
  dateStr: "1 January 2026",
};

// --- 1. Absent by default: no heading, no empty clause.
{
  const html = buildLetterHtml(base);
  check("no heading when there are no special terms", html.includes("Specific terms agreed with you"), false);
}

// --- 2. Present when set, with its own heading and before the agreement clause.
{
  const html = buildLetterHtml({ ...base, specialTerms: "The first quarter fee is waived." });
  check("heading rendered", html.includes("Specific terms agreed with you"), true);
  check("the text itself appears", html.includes("The first quarter fee is waived."), true);
  check(
    "sits before the agreement clause",
    html.indexOf("Specific terms agreed with you") < html.indexOf("Agreement of terms"),
    true,
  );
  check(
    "precedence sentence included",
    html.includes("the following applies"),
    true,
  );
}

// --- 3. Whitespace-only is treated as absent, not as an empty clause.
{
  const html = buildLetterHtml({ ...base, specialTerms: "   \n\n  " });
  check("whitespace-only renders nothing", html.includes("Specific terms agreed with you"), false);
}

// --- 4. Staff type plain text into a free-text box. It must not be able to
//        inject markup into a contract, or alter the letter around it.
{
  const nasty = 'Fee is <b>waived</b> & "agreed" <script>alert(1)</script>';
  const html = buildLetterHtml({ ...base, specialTerms: nasty });
  check("script tag is escaped", html.includes("<script>alert(1)</script>"), false);
  check("escaped form present", html.includes("&lt;script&gt;"), true);
  check("ampersand escaped", html.includes("&amp;"), true);
  check("bold tag not honoured", html.includes("Fee is <b>waived</b>"), false);
}

// --- 5. Blank lines become separate paragraphs; single newlines stay inside one.
{
  const html = buildLetterHtml({ ...base, specialTerms: "First point.\n\nSecond point.\nStill second." });
  const section = html.slice(html.indexOf("Specific terms agreed with you"), html.indexOf("Agreement of terms"));
  check("two paragraphs from the blank line", (section.match(/First point\.|Second point\./g) ?? []).length, 2);
  check("single newline kept within a paragraph", section.includes("<br>"), true);
}

// --- 6. The PDF says the same thing, in the same place.
{
  const { buildEngagementPdf } = await import("../lib/engagement-pdf");
  const pdf = await buildEngagementPdf({ ...base, specialTerms: "The first quarter fee is waived." });
  const doc = await PDFDocument.load(pdf);
  check("PDF builds with special terms", doc.getPageCount() > 0, true);
  const without = await buildEngagementPdf(base);
  check("special terms add content to the PDF", pdf.length > without.length, true);
}

// --- 7. Description of the work: absent by default.
{
  const html = buildLetterHtml(base);
  check("no description heading when blank", html.includes("Description of the work"), false);
  const blank = buildLetterHtml({ ...base, workDescription: "  \n\n " });
  check("whitespace-only description prints nothing", blank.includes("Description of the work"), false);
}

// --- 8. Description: under Scope of services, before the responsibilities, and NOT an override.
{
  const html = buildLetterHtml({ ...base, workDescription: "Rental income for two let properties.\n\nSelf-assessment each year." });
  const scope = html.indexOf("Scope of services to be provided");
  const at = html.indexOf("Description of the work");
  const resp = html.indexOf("Our responsibility to you");
  check("description is printed", at > 0, true);
  check("description sits inside Scope of services", scope < at && at < resp, true);
  check("description keeps its paragraphs", html.includes("<p>Rental income for two let properties.</p>") && html.includes("<p>Self-assessment each year.</p>"), true);
  const descSection = html.slice(at, resp);
  check("description carries no precedence wording", /takes precedence|the following applies/i.test(descSection), false);
  check("description alone adds no specific-terms clause", html.includes("Specific terms agreed with you"), false);
}

// --- 9. Description is escaped like the specific terms.
{
  const html = buildLetterHtml({ ...base, workDescription: `<script>alert(1)</script> & "quotes"` });
  check("description markup is escaped", html.includes("<script>alert(1)</script>"), false);
}

// --- 10. Both together: each in its own place.
{
  const html = buildLetterHtml({ ...base, workDescription: "Work described.", specialTerms: "Fee waived." });
  check("both print, description first", html.indexOf("Description of the work") < html.indexOf("Specific terms agreed with you"), true);
}

// --- 11. The PDF carries the description too.
{
  const { buildEngagementPdf } = await import("../lib/engagement-pdf");
  const withDesc = await buildEngagementPdf({ ...base, workDescription: "Rental income for two let properties." });
  const without = await buildEngagementPdf(base);
  check("description adds content to the PDF", withDesc.length > without.length, true);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log("  FAIL  " + f));
  process.exit(1);
}
