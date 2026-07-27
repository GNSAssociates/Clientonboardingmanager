/**
 * Professional clearance → PDF letter.
 *
 * Replaces the previous .docx attachment. A PDF is sent because the letter is a
 * formal record between practices: a Word file can be edited by the recipient
 * and re-circulated as though it were ours.
 *
 * Built with pdf-lib (pure JS, no native binaries) so it runs on the cPanel /
 * Passenger host, where the React-PDF renderer could not be loaded.
 *
 * Layout follows the firm's letterhead: logo + tagline header and the practice
 * details footer repeated on every page, and the acting partner's own scanned
 * signature — the partner who issued the engagement letter to that client.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import type { FirmConfig } from "./firms";
import { GNS_LOGO_DATA_URI, GNS_SIGNATURE_DATA_URI } from "./brand-assets";
import { SG_SIGNATURE_DATA_URI } from "./sg-signature";
import { MG_SIGNATURE_DATA_URI } from "./mg-signature";

/** Each partner signs with their own signature (same map as the engagement letter). */
const PARTNER_SIGNATURES: Record<string, string> = {
  "Lekh Nath Ghimire": GNS_SIGNATURE_DATA_URI,
  "Subash Ghimire": SG_SIGNATURE_DATA_URI,
  "Mahesh Giri": MG_SIGNATURE_DATA_URI,
};

export interface ClearancePdfInput {
  firm: FirmConfig;
  clientName: string;
  companyNumber?: string;
  directorName?: string;
  prevFirmName: string;
  prevFirmAddress?: string;
  /** Staff-selected records; falls back to the standard handover list. */
  docItems?: unknown[];
  /** Acting partner — the one who issued the engagement. Defaults to the firm's. */
  partnerName?: string;
  today?: string;
}

// ── Page geometry (A4, in points) ─────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 56;
const HEADER_TOP = PAGE_H - 34;
const HEADER_H = 54;
const BODY_TOP = PAGE_H - HEADER_H - 40;
const FOOTER_H = 56;
const BODY_BOTTOM = FOOTER_H + 16;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const BODY_SIZE = 10.5;
const LINE = 14;
const GREY = rgb(0.42, 0.45, 0.5);
const INK = rgb(0.11, 0.13, 0.17);

const DEFAULT_RECORDS = [
  "Copies of the bookkeeping files / working papers for the current tax year for the company.",
  "Previous year profit and loss and balance sheet ledgers with a detailed breakdown.",
  "Current year's year-to-date trial balance, up to the date you have completed bookkeeping for the client.",
  "Detailed profit and loss and balance sheet, schedules, capital allowances record, director's loan account and details of s455 tax (if relevant) for the last 2 tax years as filed with HMRC and Companies House.",
  "Copies of the director's last 2 years' personal tax returns, together with any P60s / P45s relevant to a return not yet filed.",
];

const TAX_REFERENCES = [
  "Company UTR.",
  "Companies House authentication code.",
  "VAT certificate and confirmation of the box 5 figure on the last filed VAT return.",
  "PAYE reference and Accounts Office reference number.",
  "Director's UTR and National Insurance number.",
];

const PAYROLL_ITEMS = [
  "Current year payroll up to the last filed RTI period, showing gross, tax, NI, employer NI and pension (staff details, P11 deductions workings and RTI filings).",
  "Copies of the previous 2 years' P60s / P45s and a complete payroll report showing gross, tax, NI, employer NI and pension, as required for preparing the year-end accounts.",
  "Details of statutory payments such as SSP and SMP paid to employees.",
  "VAT returns submitted for the last four quarters with a detailed breakdown of input and output VAT and the respective net figures (if online software access is not provided).",
  "Copies of recent correspondence with HM Revenue & Customs and details of any outstanding matters.",
];

/** Standard fonts use WinAnsi: map typographic characters and drop anything else. */
function sanitize(text: string): string {
  return String(text ?? "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function itemLabel(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    return String(o.label ?? o.title ?? o.name ?? o.description ?? "").trim();
  }
  return "";
}

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0.12, 0.23, 0.54);
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function embedDataUri(pdf: PDFDocument, dataUri: string): Promise<PDFImage | null> {
  const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(dataUri ?? "");
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[2]!, "base64");
    return m[1]!.toLowerCase() === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null; // never let a bad asset block the letter
  }
}

/** Greedy word wrap to a pixel width. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    // A single word longer than the column: hard-break it.
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    } else line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildClearancePdf(input: ClearancePdfInput): Promise<Buffer> {
  const {
    firm,
    clientName,
    companyNumber,
    directorName,
    prevFirmName,
    prevFirmAddress,
    docItems,
    partnerName,
    today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  } = input;

  const partner = partnerName?.trim() || firm.partnerName;
  const accent = hexToRgb(firm.accentColor);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Professional Clearance - ${sanitize(clientName)}`);
  pdf.setAuthor(firm.legalName);
  pdf.setSubject("Professional clearance request");
  pdf.setProducer(firm.legalName);
  pdf.setCreationDate(new Date());

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const logo = await embedDataUri(pdf, GNS_LOGO_DATA_URI);
  const signature = await embedDataUri(pdf, PARTNER_SIGNATURES[partner] ?? GNS_SIGNATURE_DATA_URI);

  let page!: PDFPage;
  let y = 0;

  const drawFurniture = (p: PDFPage) => {
    // Header — logo left, tagline and registration right.
    if (logo) {
      const h = 34;
      const w = (logo.width / logo.height) * h;
      p.drawImage(logo, { x: MARGIN_X, y: HEADER_TOP - h, width: w, height: h });
    }
    const tagline = firm.tagline ?? "Truly Professional";
    p.drawText(sanitize(tagline), {
      x: PAGE_W - MARGIN_X - italic.widthOfTextAtSize(sanitize(tagline), 11),
      y: HEADER_TOP - 14,
      size: 11,
      font: italic,
      color: accent,
    });
    if (firm.regNumber) {
      const reg = `(${firm.regBody} Registration No. ${firm.regNumber})`;
      p.drawText(sanitize(reg), {
        x: PAGE_W - MARGIN_X - font.widthOfTextAtSize(sanitize(reg), 7.5),
        y: HEADER_TOP - 27,
        size: 7.5,
        font,
        color: GREY,
      });
    }
    p.drawRectangle({
      x: MARGIN_X,
      y: PAGE_H - HEADER_H - 6,
      width: CONTENT_W,
      height: 1.6,
      color: accent,
    });

    // Footer — practice details, centred.
    const lines = [
      `${firm.legalName}, Registered in England and Wales, Company Registration No: ${firm.companyNumber}`,
      `${firm.address}, ${firm.city}, ${firm.postcode}`,
      `t: ${firm.footerTel} | m: ${firm.footerMobile} | ${firm.email} | ${firm.website}`,
    ];
    p.drawRectangle({ x: MARGIN_X, y: FOOTER_H + 2, width: CONTENT_W, height: 0.6, color: rgb(0.84, 0.86, 0.88) });
    lines.forEach((line, i) => {
      const t = sanitize(line);
      p.drawText(t, {
        x: (PAGE_W - font.widthOfTextAtSize(t, 7.2)) / 2,
        y: FOOTER_H - 10 - i * 9.5,
        size: 7.2,
        font,
        color: GREY,
      });
    });
  };

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    drawFurniture(page);
    y = BODY_TOP;
  };

  /** Reserve vertical space, breaking to a new page when the block will not fit. */
  const need = (height: number) => {
    if (y - height < BODY_BOTTOM) newPage();
  };

  const text = (
    value: string,
    opts: { font?: PDFFont; size?: number; color?: RGB; indent?: number; gap?: number; width?: number } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? BODY_SIZE;
    const indent = opts.indent ?? 0;
    const lines = wrap(value, f, size, (opts.width ?? CONTENT_W) - indent);
    for (const line of lines) {
      need(LINE);
      page.drawText(line, { x: MARGIN_X + indent, y, size, font: f, color: opts.color ?? INK });
      y -= LINE;
    }
    y -= opts.gap ?? 0;
  };

  const bullet = (value: string) => {
    const label = sanitize(value);
    if (!label) return;
    const lines = wrap(label, font, BODY_SIZE, CONTENT_W - 16);
    need(LINE * Math.min(lines.length, 3));
    lines.forEach((line, i) => {
      need(LINE);
      if (i === 0) page.drawText("•", { x: MARGIN_X + 3, y, size: BODY_SIZE, font, color: accent });
      page.drawText(line, { x: MARGIN_X + 16, y, size: BODY_SIZE, font, color: INK });
      y -= LINE;
    });
  };

  const heading = (value: string) => {
    need(LINE * 3);
    y -= 6;
    page.drawText(sanitize(value), { x: MARGIN_X, y, size: 10.5, font: bold, color: accent });
    y -= LINE;
  };

  newPage();

  // ── Recipient ───────────────────────────────────────────────────────────────
  text("PRIVATE & CONFIDENTIAL", { font: bold, size: 9.5, color: accent, gap: 8 });
  text(prevFirmName, { font: bold });
  if (prevFirmAddress) {
    for (const line of prevFirmAddress.split(/\r?\n|,\s*/).map((s) => s.trim()).filter(Boolean)) {
      text(line);
    }
  }
  y -= 8;
  text(today, { color: GREY, gap: 10 });

  // ── Subject ─────────────────────────────────────────────────────────────────
  const subject = [
    "Re:",
    directorName ? `${directorName} and` : null,
    clientName,
    companyNumber ? `- Company No. ${companyNumber}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  text(subject, { font: bold, gap: 12 });

  // ── Body ────────────────────────────────────────────────────────────────────
  text("Dear Sirs,", { gap: 8 });
  text(
    `We have been requested to act as accountants for the above${directorName ? " (individual and company)" : ""}. In connection with this, we are writing to enquire whether there are any professional reasons why we should not accept the appointment.`,
    { gap: 8 },
  );
  text(
    "Assuming there are no such matters, we should be grateful if you would provide us with the following information, whichever are relevant:",
    { gap: 4 },
  );

  const selected = (docItems ?? []).map(itemLabel).filter(Boolean);

  heading("Records and working papers");
  (selected.length ? selected : DEFAULT_RECORDS).forEach(bullet);

  heading("Online access and software");
  bullet(`MTD-compatible software - please send an invitation to ${firm.mtdEmail}.`);
  bullet("HMRC and Companies House login details, if created on the client's behalf.");
  bullet(
    `NEST pension - please delegate access using Organisation Name: ${firm.nestOrgName}, Delegate Organisation ID: ${firm.nestDelegateId}.`,
  );

  heading("Tax reference numbers and codes");
  TAX_REFERENCES.forEach(bullet);

  heading("Payroll, RTI and pensions");
  PAYROLL_ITEMS.forEach(bullet);

  y -= 10;
  text("Thank you for your assistance in this matter, which will allow a smooth changeover.", { gap: 10 });

  // ── Signature ───────────────────────────────────────────────────────────────
  const signatureBlock = 96;
  need(signatureBlock);
  text("Kind regards,", { gap: 4 });
  if (signature) {
    const h = 42;
    const w = Math.min((signature.width / signature.height) * h, 190);
    need(h + 6);
    y -= h;
    page.drawImage(signature, { x: MARGIN_X, y, width: w, height: h });
    y -= 8;
  } else {
    y -= 26;
  }
  text(partner, { font: bold, size: 11 });
  const designation = partner === firm.partnerName ? firm.partnerDesignation : firm.partnerDesignation2;
  if (designation) text(designation, { size: 8.5, color: GREY });
  text(firm.partnerTitle && firm.partnerTitle !== "Partner" ? firm.partnerTitle : "Partner", { size: 9.5, color: GREY });
  text(firm.legalName, { size: 9.5, color: GREY });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/** Filename for the attachment, e.g. "Professional Clearance - Acme Ltd.pdf". */
export function clearancePdfFilename(clientName: string): string {
  const safe = sanitize(clientName).replace(/[\\/:*?"<>|]/g, "-").trim() || "Client";
  return `Professional Clearance - ${safe}.pdf`;
}
