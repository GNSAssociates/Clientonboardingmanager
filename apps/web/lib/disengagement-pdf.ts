/**
 * Disengagement letter → real PDF.
 *
 * The letter FROM the firm TO a departing client: what we did up to, what we
 * are not doing, what they still owe us and what we will hand over. It is the
 * document that ends the engagement, so it has to be precise about dates —
 * "we ceased to act on 14 March" is the line that decides who was responsible
 * for a filing that was missed in April.
 *
 * On the firm's letterhead, unlike the client authority letter, because this
 * one is written by us.
 *
 * Built with **pdf-lib** (NOT @react-pdf/renderer), matching engagement-pdf,
 * clearance-pdf and authority-letter-pdf. @react-pdf/renderer does not load on
 * the Passenger host and silently cost us an attachment once already.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { FirmConfig } from "./firms";
import { DANCING_SCRIPT_DATA_URI } from "./font-cursive";
import { GNS_LOGO_DATA_URI, GNS_SIGNATURE_DATA_URI } from "./brand-assets";

export interface DisengagementPdfInput {
  firm: FirmConfig;
  clientName: string;
  companyNumber?: string;
  directorName?: string;
  clientAddress?: string;
  /** The date we ceased to act. The whole point of the letter. */
  ceasedOn: string;
  /** Services we were providing, so the letter names what is ending. */
  services?: string[];
  /** The last period we completed for each service, where it is known. */
  lastWorkDone?: string;
  /** Anything outstanding the client must deal with themselves from now on. */
  clientMustNowDo?: string[];
  /** Fees still unpaid, stated plainly rather than hinted at. */
  outstandingFees?: string;
  /** Free text the partner wants on this particular letter. */
  extraNotes?: string;
  partnerName?: string;
  today: string;
}

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const INK = hex("#111111");
const MUTED = hex("#333333");
const LABEL = hex("#555555");
const SIG_BLUE = hex("#1a3fa0");

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { top: 46, bottom: 44, x: 56 };
const CONTENT_W = A4.w - MARGIN.x * 2;

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

async function embedDataUri(pdf: PDFDocument, uri: string) {
  try {
    const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(uri ?? "");
    if (!m) return null;
    const bytes = Buffer.from(m[2]!, "base64");
    return m[1]!.toLowerCase() === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    // A missing logo must never stop the letter being produced.
    return null;
  }
}

export async function buildDisengagementPdf(input: DisengagementPdfInput): Promise<Buffer> {
  const d = input;
  const f = d.firm;
  const accent = hex(f.accentColor || "#cc2229");
  const clientLabel = `${d.clientName}${d.companyNumber ? ` (Company No. ${d.companyNumber})` : ""}`;
  const clientAddressLines = (d.clientAddress ?? "").split(/\n|,/).map((s) => s.trim()).filter(Boolean);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Disengagement — ${d.clientName}`);
  pdf.setAuthor(f.legalName);
  pdf.setSubject("Disengagement letter");
  pdf.setCreationDate(new Date());

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  let script: PDFFont = italic;
  try {
    script = await pdf.embedFont(Buffer.from(DANCING_SCRIPT_DATA_URI.split(",")[1]!, "base64"));
  } catch { script = italic; }

  const logo = await embedDataUri(pdf, GNS_LOGO_DATA_URI);
  const signature = await embedDataUri(pdf, GNS_SIGNATURE_DATA_URI);

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN.top;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN.bottom) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN.top;
    }
  };

  const para = (
    text: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gapAfter?: number } = {},
  ) => {
    const fnt = opts.font ?? font;
    const size = opts.size ?? 10.5;
    const color = opts.color ?? INK;
    const lh = size * 1.5;
    for (const line of wrap(text, fnt, size, CONTENT_W)) {
      ensureSpace(lh);
      page.drawText(line, { x: MARGIN.x, y: y - size, size, font: fnt, color });
      y -= lh;
    }
    y -= opts.gapAfter ?? 8;
  };

  const bullet = (text: string) => {
    const size = 10.5;
    const lh = size * 1.45;
    const lines = wrap(text, font, size, CONTENT_W - 14);
    lines.forEach((line, i) => {
      ensureSpace(lh);
      if (i === 0) page.drawText("•", { x: MARGIN.x, y: y - size, size, font, color: accent });
      page.drawText(line, { x: MARGIN.x + 14, y: y - size, size, font, color: INK });
      y -= lh;
    });
    y -= 3;
  };

  /* ── letterhead ─────────────────────────────────────────────────────── */
  if (logo) {
    const w = 118;
    const h = (logo.height / logo.width) * w;
    page.drawImage(logo, { x: MARGIN.x, y: y - h, width: w, height: h });
  }
  {
    const right = A4.w - MARGIN.x;
    const put = (t: string, size: number, fnt: PDFFont, color: ReturnType<typeof rgb>, dy: number) => {
      const w = fnt.widthOfTextAtSize(t, size);
      page.drawText(t, { x: right - w, y: y - dy, size, font: fnt, color });
    };
    put(f.legalName, 10, bold, INK, 10);
    put(f.address, 8.5, font, LABEL, 23);
    put(`${f.phone}  ·  ${f.email}`, 8.5, font, LABEL, 35);
  }
  y -= 64;
  page.drawLine({
    start: { x: MARGIN.x, y }, end: { x: A4.w - MARGIN.x, y },
    thickness: 1.6, color: accent,
  });
  y -= 24;

  /* ── addressee and date ─────────────────────────────────────────────── */
  para(d.today, { size: 10, color: LABEL, gapAfter: 12 });
  para(clientLabel, { font: bold, size: 11, gapAfter: 2 });
  if (d.directorName) para(`FAO: ${d.directorName}`, { size: 10, color: MUTED, gapAfter: 2 });
  for (const line of clientAddressLines) para(line, { size: 10, color: MUTED, gapAfter: 0 });
  y -= 14;

  para("Dear " + (d.directorName ? d.directorName.split(" ")[0] : "Sir or Madam") + ",", { gapAfter: 10 });
  para("DISENGAGEMENT — CESSATION OF PROFESSIONAL SERVICES", { font: bold, size: 11.5, gapAfter: 12 });

  /* ── the substance ──────────────────────────────────────────────────── */
  para(
    `We write to confirm that ${f.legalName} ceased to act as your accountants and advisers with ` +
    `effect from ${d.ceasedOn}. This letter records the position at that date so that there is no ` +
    `doubt about what we have and have not done on your behalf.`,
  );

  if (d.services?.length) {
    para("The following services have ended:", { font: bold, size: 10.5, gapAfter: 6 });
    d.services.forEach(bullet);
    y -= 4;
  }

  if (d.lastWorkDone) {
    para("Work completed up to the date of cessation", { font: bold, size: 10.5, gapAfter: 6 });
    para(d.lastWorkDone);
  }

  para(
    "We are not responsible for any returns, filings, payments or other obligations falling due on or " +
    `after ${d.ceasedOn}, whether or not they relate to an earlier period. Responsibility for those ` +
    "matters rests with you, or with any adviser you appoint in our place.",
  );

  if (d.clientMustNowDo?.length) {
    para("Matters now in your hands", { font: bold, size: 10.5, gapAfter: 6 });
    d.clientMustNowDo.forEach(bullet);
    y -= 4;
  }

  para(
    "Should you appoint another firm, we will respond promptly to their professional clearance enquiry " +
    "and provide the information we properly hold, subject to our right of lien over documents where " +
    "fees remain outstanding. We will retain your records for the period required by law and our " +
    "regulator, after which they will be securely destroyed.",
  );

  if (d.outstandingFees) {
    para("Fees", { font: bold, size: 10.5, gapAfter: 6 });
    para(d.outstandingFees);
  }

  if (d.extraNotes) {
    para(d.extraNotes);
  }

  para(
    "We have appreciated the opportunity to act for you and wish you every success. If anything in this " +
    "letter is not as you understood it, please tell us at once so that it can be corrected.",
    { gapAfter: 16 },
  );

  /* ── sign-off ───────────────────────────────────────────────────────── */
  ensureSpace(96);
  para("Yours sincerely,", { gapAfter: 6 });
  const partner = d.partnerName || "Lekh Nath Ghimire";
  if (signature) {
    const w = 118;
    const h = (signature.height / signature.width) * w;
    ensureSpace(h + 28);
    page.drawImage(signature, { x: MARGIN.x, y: y - h, width: w, height: h });
    y -= h + 6;
  } else {
    ensureSpace(34);
    page.drawText(partner, { x: MARGIN.x, y: y - 20, size: 20, font: script, color: SIG_BLUE });
    y -= 30;
  }
  para(partner, { font: bold, size: 10.5, gapAfter: 1 });
  para(f.legalName, { size: 10, color: MUTED, gapAfter: 0 });

  return Buffer.from(await pdf.save());
}

export function disengagementPdfFilename(clientName: string): string {
  const safe = (clientName || "Client").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
  return `Disengagement_Letter_${safe}.pdf`;
}
