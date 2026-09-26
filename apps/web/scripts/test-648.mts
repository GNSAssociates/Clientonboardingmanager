/**
 * Asserts the 64-8 field mapping by reading values back off the form.
 *
 * Content-stream scraping proved unreliable here — pdf-lib writes generated
 * appearances as hex strings and comb fields draw one character per box, so a
 * correctly filled form can look empty to a text search. Reading the field
 * values is the thing we actually care about.
 *
 *   node_modules/.bin/tsx scripts/test-648.mts
 */
import { PDFDocument } from "pdf-lib";
import { FIRMS } from "../lib/firms";
import { buildForm648Doc, is648Enabled, EMPTY_648_TAXES, type Form648Input } from "../lib/form-648-pdf";

let pass = 0;
const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) pass++;
  else failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function fieldsOf(input: Form648Input) {
  const doc = await buildForm648Doc({ ...input, keepEditable: true });
  const form = doc.getForm();
  return {
    text: (n: string) => {
      try {
        return form.getTextField(n).getText() ?? "";
      } catch {
        return "<<no such field>>";
      }
    },
    ticked: (n: string) => {
      try {
        return form.getCheckBox(n).isChecked();
      } catch {
        return "<<no such box>>";
      }
    },
  };
}

const base: Form648Input = {
  firm: FIRMS.gns!,
  clientName: "Jane Elizabeth Smith",
  companyName: "Trial Ltd",
  address: "42 Example Street, Someborough, Greater London, W1A 1AA",
  postcode: "w1a 1aa",
  phone: "020 7946 0000",
  utr: "1234567890",
  companyNumber: "12345678",
  taxes: { ...EMPTY_648_TAXES, corpTax: true, vat: true, employerPaye: true },
};

// --- 1. Client details, in capitals, with the postcode not duplicated.
{
  const f = await fieldsOf(base);
  check("txtName is capitals", f.text("txtName"), "JANE ELIZABETH SMITH");
  check("txtCompanyName is capitals", f.text("txtCompanyName"), "TRIAL LTD");
  check("address line 1", f.text("YourAddress1"), "42 EXAMPLE STREET");
  check("address line 2", f.text("YourAddress2"), "SOMEBOROUGH");
  check("trailing postcode dropped from address", f.text("YourAddress3"), "GREATER LONDON");
  check("postcode box", f.text("YourPost code"), "W1A 1AA");
  check("phone kept as dialled", f.text("YourPhoneNumber"), "020 7946 0000");
  check("company number", f.text("CRN"), "12345678");
}

// --- 2. Agent details come from firm config, per firm.
{
  const gns = await fieldsOf(base);
  check("GNS agent name", gns.text("AgentName"), "GNS Associates Limited");
  check("GNS SA code", gns.text("Agent code SA"), "1319LR");
  check("GNS CT code", gns.text("Agent code CT"), "H6558B");
  check("GNS gateway id", gns.text("CIS Agent Gateway ID"), "GNSAssociate-T29GTG2XQMUD");
  check("GNS PAYE agent id", gns.text("CIS PAYE ID"), "HT1865");

  const llp = await fieldsOf({ ...base, firm: FIRMS.llp! });
  check("LLP agent name", llp.text("AgentName"), "GNS Associates UK LLP");
  check("LLP SA code", llp.text("Agent code SA"), "2904RD");
  check("LLP CT code", llp.text("Agent code CT"), "H7698B");
  check("LLP gateway id", llp.text("CIS Agent Gateway ID"), "F3MBHIDTA1U7-UAWPX6DQBF8C");
  check("LLP PAYE agent id", llp.text("CIS PAYE ID"), "HZ0824");
}

// --- 3. A firm with no codes must not inherit another firm's.
{
  const galaxy = await fieldsOf({ ...base, firm: FIRMS.galaxy! });
  check("Galaxy SA code blank", galaxy.text("Agent code SA"), "");
  check("Galaxy CT code blank", galaxy.text("Agent code CT"), "");
  check("Galaxy gateway id blank", galaxy.text("CIS Agent Gateway ID"), "");
  check("Galaxy PAYE id blank", galaxy.text("CIS PAYE ID"), "");
  check("Galaxy agent name still set", galaxy.text("AgentName"), "GALAXY GNS ACCOUNTANTS LTD");
}

// --- 4. Tick set drives the boxes, both on and off.
{
  const f = await fieldsOf(base);
  check("corp tax ticked", f.ticked("chkCorpTax"), true);
  check("VAT ticked", f.ticked("chkVAT"), true);
  check("employer PAYE ticked", f.ticked("chkEmp PAYE scheme"), true);
  check("SA not ticked", f.ticked("chkSA"), false);
  check("CIS not ticked", f.ticked("chkCIS"), false);
  check("trust not ticked", f.ticked("chkTrust"), false);

  // The template ships with six boxes pre-ticked by HMRC's sample; an empty
  // tick set must clear every one of them.
  const none = await fieldsOf({ ...base, taxes: EMPTY_648_TAXES });
  for (const box of ["chkSA", "chkCorpTax", "chkPAYE", "chkVAT", "chkCIS", "chkEmp PAYE scheme"]) {
    check(`${box} cleared when unticked`, none.ticked(box), false);
  }
}

// --- 5. UTR goes to the regime it was issued under, split into halves.
{
  const ct = await fieldsOf(base);
  check("CT UTR first half", ct.text("CT UTR 1-5"), "12345");
  check("CT UTR second half", ct.text("CT UTR 6-10"), "67890");
  check("SA UTR left blank for a company", ct.text("UTR 1-5"), "");

  const sa = await fieldsOf({ ...base, taxes: { ...EMPTY_648_TAXES, sa: true } });
  check("SA UTR first half", sa.text("UTR 1-5"), "12345");
  check("SA UTR second half", sa.text("UTR 6-10"), "67890");

  // A UTR we do not hold, or a malformed one, must leave the boxes empty
  // rather than print a partial reference HMRC would reject.
  const noUtr = await fieldsOf({ ...base, utr: "123" });
  check("short UTR left blank", noUtr.text("CT UTR 1-5"), "");
  const spaced = await fieldsOf({ ...base, utr: "12345 67890" });
  check("spaced UTR still splits", spaced.text("CT UTR 1-5"), "12345");
}

// --- 6. Over-long values are trimmed to fit, never dropped.
{
  const long = await fieldsOf({
    ...base,
    companyName: "A Very Considerably Overlong Company Name Limited Incorporated",
  });
  const v = long.text("txtCompanyName");
  check("long company name kept (trimmed)", v.length > 0 && v.length <= 40, true);
  check("long company name starts correctly", v.startsWith("A VERY CONSIDERABLY"), true);
}

// --- 7. The signed copy flattens: no editable fields survive.
{
  const signed = await buildForm648Doc({
    ...base,
    signedName: "Jane Elizabeth Smith",
    signedAt: "2026-09-26T10:30:00.000Z",
  });
  const bytes = await signed.save();
  const reloaded = await PDFDocument.load(bytes);
  let count = -1;
  try {
    count = reloaded.getForm().getFields().length;
  } catch {
    count = 0;
  }
  check("signed copy has no editable fields", count, 0);
  check("signed copy page count", reloaded.getPageCount(), 3);
}

// --- 8. Engagements that predate this feature must not acquire a 64-8.
//
// Their PDFs are rebuilt on every request, so a missing flag defaulting to
// "include" would retrospectively add an authorisation to contracts that are
// already signed.
{
  check("no letterMeta at all", is648Enabled(undefined), false);
  check("letterMeta with no flag (pre-existing engagement)", is648Enabled({ includeAnnexA: true }), false);
  check("explicitly off", is648Enabled({ include648: false }), false);
  check("explicitly on", is648Enabled({ include648: true }), true);
  // Only a real boolean counts; a stray string must not switch it on.
  check("string 'true' does not enable", is648Enabled({ include648: "true" }), false);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log("  FAIL  " + f));
  process.exit(1);
}
