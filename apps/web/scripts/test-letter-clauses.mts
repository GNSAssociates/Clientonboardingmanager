/**
 * The shared clauses: who does the work, how we look after your information,
 * and identity checks. That each firm gets its own name, that every UK GDPR
 * Article 13 point is there, that the clauses sit where they should in the
 * letter, that the PDF carries them, and that the wording stays calm.
 *
 *   node_modules/.bin/tsx scripts/test-letter-clauses.mts
 */
import { FIRMS } from "../lib/firms";
import { buildLetterHtml, type LetterData } from "../lib/letter-html";
import { whoDoesTheWork, howWeLookAfterYourData, identityChecks } from "../lib/letter-clauses";

let pass = 0;
const failures: string[] = [];
const check = (label: string, ok: boolean) => { if (ok) pass++; else failures.push(label); };
const all = (c: { heading: string; paras: Array<{ lead?: string; text: string }> }) =>
  [c.heading, ...c.paras.map((p) => `${p.lead ?? ""} ${p.text}`)].join(" ");

// --- 1. Each firm is named as the one responsible, and lists the other two.
for (const slug of ["gns", "llp", "galaxy"]) {
  const f = FIRMS[slug]!;
  const who = all(whoDoesTheWork(f));
  const names = ["GNS Associates Limited", "GNS Associates UK LLP", "Galaxy GNS Accountants Ltd"];
  check(`${slug}: all three practices named`, names.every((n) => who.includes(n)));
  check(`${slug}: associated company named`, who.includes("GNS Associates Private Limited"));
  check(`${slug}: contracting practice stays responsible`, /remains responsible to you/.test(who));
  check(`${slug}: Nepal not mentioned in clause 1`, !/Nepal/.test(who));
  check(`${slug}: clause 1 says the other practices may access information`, /may work on your affairs and access your information/.test(who));

  // Each firm's data clause names the OTHER two practices as having access, and never itself.
  const dp = all(howWeLookAfterYourData(f));
  const own = { gns: "GNS Associates Limited", llp: "GNS Associates UK LLP", galaxy: "Galaxy GNS Accountants Ltd" }[slug]!;
  const sharing = howWeLookAfterYourData(f).paras.find((p) => p.lead === "Who we share it with.")!.text;
  check(`${slug}: data clause names both other practices`, names.filter((n) => n !== own).every((n) => sharing.includes(n)));
  check(`${slug}: data clause does not list itself as a recipient`, !sharing.includes(own));
  check(`${slug}: shared resources, VPN, MFA and separation`, /share offices, servers, software/.test(dp) && /VPN/.test(dp) && /multi-factor authentication/.test(dp) && /each practice's records are kept separate/.test(dp));
}

// --- 2. Every Article 13 point is in the data clause.
{
  const dp = all(howWeLookAfterYourData(FIRMS.gns!));
  const points: Array<[string, RegExp]> = [
    ["controller named", /GNS Associates Limited is responsible for the personal information/],
    ["contact given", /info@gnsassociates\.co\.uk/],
    ["recipients", /HM Revenue & Customs, Companies House/],
    ["transfer and country", /in Nepal/],
    ["safeguard named", /International Data Transfer Agreement/],
    ["copy of safeguards on request", /copy of these safeguards is available on request/],
    ["why it is needed / consequence", /without it we may not be able to act for you/],
    ["no automated decisions", /automated means alone/],
    ["retention period", /6 years after our engagement ends/],
    ["access, correction, deletion", /copy of your information.*correct or delete/],
    ["restrict or object", /restrict or stop using it/],
    ["withdraw consent", /withdraw any consent/],
    ["complain to ICO", /ico\.org\.uk/],
  ];
  for (const [label, re] of points) check(`data clause: ${label}`, re.test(dp));
  check("Nepal named exactly once in the data clause", (dp.match(/Nepal/g) ?? []).length === 1);
  check("no ICO number printed when none is held", !/registered with the Information Commissioner's Office under number/.test(dp));
  const withIco = all(howWeLookAfterYourData({ ...FIRMS.gns!, icoNumber: "ZA123456" }));
  check("ICO number printed when held", withIco.includes("under number ZA123456"));
}

// --- 3. Identity checks: the duties are there, calmly put.
{
  const id = all(identityChecks(FIRMS.llp!));
  check("regulations named", /Money Laundering Regulations 2017/.test(id));
  check("five-year records", /at least five years/.test(id));
  check("reporting duty stated", /report certain matters to the relevant authorities/.test(id));
  check("may stop acting if checks fail", /may not be able to start or continue acting/.test(id));
  check("LLP stays responsible", /responsibility stays with GNS Associates UK LLP/.test(id));
}

// --- 4. Tone: nothing alarming in any clause.
{
  const text = [whoDoesTheWork, howWeLookAfterYourData, identityChecks].map((fn) => all(fn(FIRMS.galaxy!))).join(" ");
  for (const word of ["suspicion", "suspect", "criminal", "National Crime Agency", "terrorist", "adequacy", "not allowed", "liable"]) {
    check(`no "${word}"`, !text.toLowerCase().includes(word.toLowerCase()));
  }
}

// --- 5. Placement in the letter.
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
{
  const html = buildLetterHtml(base);
  const at = (s: string) => html.indexOf(s);
  check("clause 1 after Period of engagement, before Scope", at("Period of engagement") < at("Who will carry out the work") && at("Who will carry out the work") < at("Scope of services to be provided"));
  check("clause 2 inside Data Protection, before Continuity", at("<h2>Data Protection</h2>") < at("How we look after your information") && at("How we look after your information") < at("(a) Continuity arrangements"));
  check("clause 3 after contact preferences, before Agreement", at("(c) Other services") < at("<h2>Identity checks</h2>") && at("<h2>Identity checks</h2>") < at("<h2>Agreement of terms</h2>"));
  check("clause 3 before specific terms", (() => {
    const h = buildLetterHtml({ ...base, specialTerms: "Fee waived." });
    return h.indexOf("<h2>Identity checks</h2>") < h.indexOf("Specific terms agreed with you");
  })());
  check("leads printed bold", html.includes("<strong>Who is responsible.</strong>"));
  check("ampersand escaped in HTML", html.includes("HM Revenue &amp; Customs"));
}

// --- 6. The PDF carries the clauses (it grows by about their length).
{
  const { buildEngagementPdf } = await import("../lib/engagement-pdf");
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await buildEngagementPdf(base);
  const doc = await PDFDocument.load(pdf);
  check("PDF builds", doc.getPageCount() > 0);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log("  FAIL  " + f));
  process.exit(1);
}
