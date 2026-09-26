/** Blank 64-8 per firm: agent side only, exactly as it goes to a client. */
import fs from "node:fs";
import path from "node:path";
import { FIRMS } from "../lib/firms";
import { buildForm648Bytes, EMPTY_648_TAXES } from "../lib/form-648-pdf";

const outDir = process.argv[2] || ".";
for (const slug of ["gns", "llp"]) {
  const firm = FIRMS[slug]!;
  const bytes = await buildForm648Bytes({ firm, clientName: "", taxes: EMPTY_648_TAXES });
  const dest = path.join(outDir, `template-64-8-${firm.legalName.replace(/[^\w]+/g, "-")}.pdf`);
  fs.writeFileSync(dest, bytes);
  console.log(`${path.basename(dest)}  ${bytes.length} bytes`);
}
