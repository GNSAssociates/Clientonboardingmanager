/**
 * Every version of the engagement letter says the three practices share
 * staff, offices and systems, and names the other two:
 *   - the online letter and PDF (lib/letter-clauses.ts),
 *   - the terms of business (clause 3, Confidentiality) and the privacy
 *     notice (Data sharing, overseas processing),
 *   - the Word download (lib/engagement-docx.ts), which staff edit and send.
 * Also that the Word download carries the advice-letter layout.
 *
 *   node_modules/.bin/tsx scripts/test-shared-wording.mts
 */
import { inflateRawSync } from "node:zlib";
import { FIRMS } from "../lib/firms";
import { buildTermsOfBusinessHtml, buildPrivacyNoticeHtml } from "../lib/terms-of-business";
import { otherPractices } from "../lib/letter-clauses";
import type { LetterData } from "../lib/letter-html";

let pass = 0;
const failures: string[] = [];
const check = (label: string, ok: boolean) => { if (ok) pass++; else failures.push(label); };
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ");

/** word/document.xml out of a .docx (a zip), with Node's zlib only. */
function docxText(buf: Buffer): string {
  let i = 0;
  while ((i = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), i)) >= 0) {
    const method = buf.readUInt16LE(i + 8);
    const csize = buf.readUInt32LE(i + 18);
    const nlen = buf.readUInt16LE(i + 26);
    const xlen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nlen).toString();
    const start = i + 30 + nlen + xlen;
    if (name === "word/document.xml") {
      const data = buf.subarray(start, start + csize);
      const xml = (method === 8 ? inflateRawSync(data) : data).toString("utf8");
      return xml.replace(/<w:tab\/>/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/\s+/g, " ");
    }
    i = start + csize;
  }
  return "";
}

const all = ["GNS Associates Limited", "GNS Associates UK LLP", "Galaxy GNS Accountants Ltd"];

for (const slug of ["gns", "llp", "galaxy"]) {
  const f = FIRMS[slug]!;
  const others = otherPractices(f.legalName);
  check(`${slug}: exactly two other practices`, others.length === 2);

  const opts = { firmName: f.name, firmLegalName: f.legalName, firmAddress: `${f.address}, ${f.city} ${f.postcode}`, regBody: f.regBody, firmEmail: f.email };
  const tob = plain(buildTermsOfBusinessHtml(opts));
  const pn = plain(buildPrivacyNoticeHtml({ ...opts, companyNumber: f.companyNumber }));
  check(`${slug}: terms name both other practices`, others.every((n) => tob.includes(n)));
  check(`${slug}: terms say resources are shared`, /share staff, offices, servers, software and other resources/.test(tob));
  check(`${slug}: terms mention VPN, MFA and separate records`, /VPN/.test(tob) && /multi-factor authentication/.test(tob) && /each practice's records are kept separate/.test(tob));
  check(`${slug}: privacy notice names both other practices`, others.every((n) => pn.includes(n)));
  check(`${slug}: privacy notice keeps "personal data"`, /access your personal data when they work on your affairs/.test(pn));
}
// Galaxy's legal name is in capitals in the firm settings: it must still exclude itself.
check("galaxy excludes itself despite capitals", !otherPractices("GALAXY GNS ACCOUNTANTS LTD").includes("Galaxy GNS Accountants Ltd"));

// --- The Word download.
const { buildEngagementDocx } = await import("../lib/engagement-docx");
const base: LetterData = {
  firm: FIRMS.llp!,
  companyName: "Sample Client",
  clientName: "Sample Client",
  clientType: "individual",
  services: [{ id: "self_assessment", name: "Self-Assessment", price: 50, oneoff: false }],
  customFees: [],
  workDescription: "Rental income for two let properties.",
  specialTerms: "First quarter fee waived.",
  dateStr: "27 November 2026",
};
{
  const t = docxText(await buildEngagementDocx(base));
  check("word: readable", t.length > 1000);
  check("word: who carries out the work", t.includes("Who will carry out the work"));
  check("word: names the other two practices", ["GNS Associates Limited", "Galaxy GNS Accountants Ltd"].every((n) => t.includes(n)));
  check("word: description of the work", t.includes("Description of the work") && t.includes("Rental income for two let properties."));
  check("word: specific terms", t.includes("Specific terms agreed with you") && t.includes("First quarter fee waived."));
  check("word: terms carry the sharing paragraph", /share staff, offices, servers, software and other resources with them/.test(t));
  check("word: ordinary intro", t.includes("act as accountant"));
}
{
  const t = docxText(await buildEngagementDocx({
    ...base, services: [], specialTerms: "",
    customFees: [{ description: "VAT position review - all income streams", price: 495, frequency: "one-off" }],
    workDescription: "Review of the VAT position of each income stream.",
    adviceMode: true, adviceSummary: "review the VAT position of your income streams",
  }));
  check("word advice: instruction", t.includes("accept your instruction to review the VAT position of your income streams"));
  check("word advice: total fixed fee", t.includes("Total fixed fee") && t.includes("£495.00+VAT"));
  check("word advice: Schedule A", t.includes("Schedule A — VAT position review - all income streams (Fixed Fee)"));
  check("word advice: description only in Schedule A", (t.match(/Review of the VAT position of each income stream\./g) ?? []).length === 1);
  check("word advice: acceptance line", t.includes("I/We agree to the fixed fee of £495.00 plus VAT"));
  check("word advice: no monthly table", !t.includes("Total one-off"));
  check("word advice: still names the other practices", all.filter((n) => n !== "GNS Associates UK LLP").every((n) => t.includes(n)));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log("  FAIL  " + f));
  process.exit(1);
}
