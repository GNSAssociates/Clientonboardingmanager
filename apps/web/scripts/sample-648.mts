/**
 * Renders sample 64-8s so the field mapping and the signature placement can be
 * checked against the real form. Not part of the build.
 *
 *   node_modules/.bin/tsx scripts/sample-648.mts <outDir>
 */
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { FIRMS } from "../lib/firms";
import { buildForm648Bytes, EMPTY_648_TAXES } from "../lib/form-648-pdf";

const outDir = process.argv[2] || ".";

const base = {
  clientName: "Jane Elizabeth Smith",
  companyName: "Trial Ltd",
  address: "42 Example Street, Someborough, Greater London",
  postcode: "w1a 1aa",
  phone: "020 7946 0000",
  utr: "1234567890",
  companyNumber: "12345678",
  taxes: { ...EMPTY_648_TAXES, corpTax: true, vat: true, employerPaye: true },
};

const cases = [
  {
    file: "sample-64-8-SIGNED-gns.pdf",
    input: {
      ...base,
      firm: FIRMS.gns!,
      signedName: "Jane Elizabeth Smith",
      signedAt: new Date().toISOString(),
      auditRef: "ENG-2026-0412-A7F3",
    },
  },
  {
    file: "sample-64-8-SIGNED-llp.pdf",
    input: {
      ...base,
      firm: FIRMS.llp!,
      signedName: "Jane Elizabeth Smith",
      signedAt: new Date().toISOString(),
      auditRef: "ENG-2026-0412-A7F3",
    },
  },
  {
    file: "sample-64-8-PREVIEW-specimen.pdf",
    input: {
      ...base,
      firm: FIRMS.gns!,
      signedName: "Jane Elizabeth Smith",
      signedAt: new Date().toISOString(),
      specimen: true,
    },
  },
  {
    file: "sample-64-8-galaxy-no-codes.pdf",
    input: { ...base, firm: FIRMS.galaxy!, signedName: "Jane Elizabeth Smith", signedAt: new Date().toISOString() },
  },
];

/**
 * A ruled copy of page 1.
 *
 * The signature and date boxes are not in the AcroForm, so their position can
 * only be confirmed by eye. This draws a labelled scale down the declaration
 * band so the correct y value can be read straight off the form instead of
 * guessed at over several rounds.
 */
async function writeRuler(dest: string) {
  const { PDFDocument: Doc, rgb, StandardFonts } = await import("pdf-lib");
  const { FORM_648_TEMPLATE_BASE64 } = await import("../lib/form-648-template");
  const pdf = await Doc.load(Buffer.from(FORM_648_TEMPLATE_BASE64, "base64"));
  pdf.getForm().flatten();
  const page = pdf.getPages()[0]!;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let y = 150; y <= 300; y += 5) {
    const major = y % 25 === 0;
    page.drawRectangle({
      x: 36,
      y,
      width: major ? 262 : 250,
      height: 0.4,
      color: major ? rgb(0.85, 0.1, 0.1) : rgb(0.35, 0.6, 0.95),
      opacity: major ? 0.85 : 0.5,
    });
    page.drawText(String(y), {
      x: 300,
      y: y - 2.5,
      size: major ? 7 : 5.5,
      font,
      color: major ? rgb(0.85, 0.1, 0.1) : rgb(0.35, 0.6, 0.95),
    });
  }
  fs.writeFileSync(dest, await pdf.save());
  console.log(`${"ruler-page1.pdf".padEnd(38)} scale drawn from y=150 to y=300`);
}

for (const c of cases) {
  const bytes = await buildForm648Bytes(c.input as Parameters<typeof buildForm648Bytes>[0]);
  const dest = path.join(outDir, c.file);
  fs.writeFileSync(dest, bytes);
  const doc = await PDFDocument.load(bytes);
  let residualFields = 0;
  try {
    residualFields = doc.getForm().getFields().length;
  } catch {
    residualFields = -1;
  }
  console.log(`${c.file.padEnd(38)} ${bytes.length} bytes, ${doc.getPageCount()} pages, fields left after flatten: ${residualFields}`);
}

await writeRuler(path.join(outDir, "ruler-page1.pdf"));
