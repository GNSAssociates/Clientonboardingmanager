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

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log("  FAIL  " + f));
  process.exit(1);
}
