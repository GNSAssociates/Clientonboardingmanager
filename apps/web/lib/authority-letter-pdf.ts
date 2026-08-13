/**
 * Client Authority (Change of Accountants) letter → real PDF.
 *
 * This is the letter FROM the client authorising the OUTGOING accountant to
 * release their records to us. It is auto-generated (pre-filled with the client,
 * GNS and previous-accountant details) and attached alongside the professional
 * clearance letter on the first email to the previous accountant.
 *
 * Deliberately rendered on PLAIN PAPER — no GNS logo, accent colour, regulator
 * badges or firm footer. The letter is written and signed by the client, so it
 * carries the client's own name, company number and address as the sender.
 *
 * Built with **pdf-lib** (NOT @react-pdf/renderer). pdf-lib is the only PDF
 * engine that loads on the cPanel / Passenger host — @react-pdf/renderer does
 * not, which is why the previous @react-pdf/renderer version of this letter
 * threw at runtime in production and the clearance email went out WITHOUT it.
 * This matches lib/engagement-pdf.ts and lib/clearance-pdf.ts.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { FirmConfig } from "./firms";
import { DANCING_SCRIPT_DATA_URI } from "./font-cursive";

export interface AuthorityLetterInput {
  firm: FirmConfig;
  clientName: string;            // the client company / individual granting authority
  companyNumber?: string;
  directorName?: string;         // who signs on the client's behalf
  clientAddress?: string;
  prevFirmName: string;          // outgoing accountant
  prevFirmContact?: string;      // named contact at the outgoing accountant (optional)
  prevFirmAddress?: string;
  today: string;
}

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const INK = hex("#111111");
const MUTED = hex("#333333");
const LABEL = hex("#555555");
const LINE = hex("#666666");
const PANEL = hex("#999999");
const SIG_BLUE = hex("#1a3fa0");

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { top: 46, bottom: 40, x: 56 };
const CONTENT_W = A4.w - MARGIN.x * 2;

/** Split text into lines that fit maxWidth for the given font/size. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildAuthorityLetterPdf(input: AuthorityLetterInput): Promise<Buffer> {
  const d = input;
  const f = d.firm;
  const bodies = f.regBodies ?? (f.regBody ? [f.regBody] : []);
  const tagline = f.regBody === "ICAEW" ? "Chartered Accountants" : "Chartered Certified Accountants";
  const advisers = bodies.includes("CIOT") ? "Chartered Accountants & Chartered Tax Advisers" : tagline;
  const clientLabel = `${d.clientName}${d.companyNumber ? ` (Company No. ${d.companyNumber})` : ""}`;
  const clientAddressLines = (d.clientAddress ?? "").split(/\n|,/).map((s) => s.trim()).filter(Boolean);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Change of Accountants — ${d.clientName}`);
  pdf.setAuthor(d.clientName || d.directorName || "Client");
  pdf.setSubject("Change of Accountants — Client Authority");
  pdf.setCreationDate(new Date());

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  // Blue cursive signature via the embedded Dancing Script font, exactly like the
  // engagement letter. If embedding ever fails, fall back to Helvetica-Oblique so
  // the letter still renders and attaches — it must NEVER silently drop again.
  let script: PDFFont = italic;
  try {
    script = await pdf.embedFont(Buffer.from(DANCING_SCRIPT_DATA_URI.split(",")[1]!, "base64"));
  } catch {
    script = italic;
  }

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN.top;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN.bottom) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN.top;
    }
  };

  // Draw one paragraph (wrapped). Returns nothing; advances y.
  const para = (
    text: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gapAfter?: number; lineHeight?: number } = {},
  ) => {
    const fnt = opts.font ?? font;
    const size = opts.size ?? 10.5;
    const color = opts.color ?? INK;
    const lh = opts.lineHeight ?? size * 1.5;
    for (const line of wrap(text, fnt, size, CONTENT_W)) {
      ensureSpace(lh);
      page.drawText(line, { x: MARGIN.x, y: y - size, size, font: fnt, color });
      y -= lh;
    }
    if (opts.gapAfter) y -= opts.gapAfter;
  };

  // ── Sender block = the CLIENT (plain paper) ────────────────────────────────
  para(d.clientName, { font: bold, size: 12, gapAfter: 2 });
  if (d.companyNumber) para(`Company No. ${d.companyNumber}`, { size: 10, color: MUTED, lineHeight: 12.5 });
  for (const line of clientAddressLines) para(line, { size: 10, color: MUTED, lineHeight: 12.5 });
  y -= 14;

  // Date
  para(d.today, { size: 10.5, gapAfter: 12 });

  // Recipient: the outgoing accountant
  if (d.prevFirmContact) para(d.prevFirmContact, { size: 10.5, lineHeight: 14 });
  para(d.prevFirmName, { size: 10.5, lineHeight: 14 });
  if (d.prevFirmAddress) para(d.prevFirmAddress, { size: 10.5, lineHeight: 14 });
  y -= 12;

  para("Dear Sir/Madam,", { gapAfter: 4 });
  para(`Re: Change of Accountants${d.clientName ? ` — ${clientLabel}` : ""}`, { font: bold, gapAfter: 7 });

  para(`I am writing to formally notify you that I have appointed ${f.legalName} as my new accountant and tax advisor with immediate effect.`, { gapAfter: 6 });
  para(`Please take this letter as my authority for you to release all my personal and business accounting, tax and payroll records to ${f.legalName}.`, { gapAfter: 6 });
  para(`Please provide ${f.legalName} with the necessary paperwork at your earliest convenience.`, { gapAfter: 10 });

  // ── "MY NEW ACCOUNTANTS" bordered panel ────────────────────────────────────
  const panelLines: Array<{ text: string; font: PDFFont; size: number; color?: ReturnType<typeof rgb> }> = [
    { text: f.legalName, font: bold, size: 10.5 },
    { text: advisers, font, size: 10.5 },
    { text: `${f.address}, ${f.city}, ${f.postcode}`, font, size: 10.5 },
    { text: `Email: ${f.email}`, font, size: 10.5 },
    { text: `Tel: ${f.footerTel}${f.footerMobile ? `, ${f.footerMobile}` : ""}`, font, size: 10.5 },
  ];
  const pad = 11;
  const labelH = 8 + 6;
  const panelBodyH = panelLines.length * 14;
  const panelH = pad + labelH + panelBodyH + pad;
  ensureSpace(panelH + 12);
  const panelTop = y;
  page.drawRectangle({
    x: MARGIN.x, y: panelTop - panelH, width: CONTENT_W, height: panelH,
    borderColor: PANEL, borderWidth: 0.75,
  });
  let py = panelTop - pad - 8;
  page.drawText("MY NEW ACCOUNTANTS", { x: MARGIN.x + pad, y: py, size: 8, font: bold, color: LABEL });
  py -= labelH;
  for (const l of panelLines) {
    py -= 0;
    page.drawText(l.text, { x: MARGIN.x + pad, y: py - l.size, size: l.size, font: l.font, color: l.color ?? INK });
    py -= 14;
  }
  y = panelTop - panelH - 12;

  para("I appreciate your cooperation in this regard.", { gapAfter: 6 });
  para("If you require any further confirmation, please let me know.", { gapAfter: 6 });
  para("Kind regards,", { gapAfter: 4 });

  // ── Signature: blue cursive script of the signing director ─────────────────
  const sigName = d.directorName ?? "";
  if (sigName) {
    ensureSpace(30 + 24);
    page.drawText(sigName, { x: MARGIN.x, y: y - 24, size: 26, font: script, color: SIG_BLUE });
    y -= 34;
  }
  // signature underline
  ensureSpace(18);
  page.drawLine({ start: { x: MARGIN.x, y }, end: { x: MARGIN.x + 220, y }, thickness: 0.75, color: LINE });
  y -= 12;
  if (sigName) para(sigName, { size: 9.5, lineHeight: 13 });
  if (d.clientName) para(`For and on behalf of ${clientLabel}`, { size: 9.5, lineHeight: 13 });
  para(`Date: ${d.today}`, { size: 9.5, lineHeight: 13 });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export function authorityLetterFilename(clientName: string): string {
  const safe = (clientName || "Client").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `Change-of-Accountants-Authority-${safe}.pdf`;
}
