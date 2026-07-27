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
 * Each firm gets its own letterhead — accent colour, legal name, practising
 * registration and the professional-body badges it is entitled to — and the
 * letter is signed by the partner who issued that client's engagement letter,
 * using their own scanned signature.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import type { FirmConfig } from "./firms";
import { GNS_LOGO_DATA_URI, GNS_SIGNATURE_DATA_URI } from "./brand-assets";
import { SG_SIGNATURE_DATA_URI } from "./sg-signature";
import { MG_SIGNATURE_DATA_URI } from "./mg-signature";
import { ACCA_LOGO_DATA_URI } from "./acca-logo";
import { ICAEW_LOGO_DATA_URI } from "./icaew-logo";
import { CIOT_LOGO_DATA_URI } from "./ciot-logo";

/** Each partner signs with their own signature (same map as the engagement letter). */
const PARTNER_SIGNATURES: Record<string, string> = {
  "Lekh Nath Ghimire": GNS_SIGNATURE_DATA_URI,
  "Subash Ghimire": SG_SIGNATURE_DATA_URI,
  "Mahesh Giri": MG_SIGNATURE_DATA_URI,
};

/** Badges shown in the footer, driven by each firm's regBodies. */
const BODY_BADGES: Record<string, string> = {
  ACCA: ACCA_LOGO_DATA_URI,
  ICAEW: ICAEW_LOGO_DATA_URI,
  CIOT: CIOT_LOGO_DATA_URI,
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
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// Header: logo and strap-line sit above the rule, never across it.
const LOGO_TOP = PAGE_H - 28;
const LOGO_H = 32;
const TAGLINE_Y = PAGE_H - 44;
const REGLINE_Y = PAGE_H - 57;
const HEADER_RULE_Y = PAGE_H - 70;
const BODY_TOP = PAGE_H - 98;

// Footer: separator, professional-body badges, then the practice details.
const FOOTER_RULE_Y = 70;
const BADGE_Y = 50;
const BADGE_H = 14;
const FOOTER_TEXT_Y = 39;
const BODY_BOTTOM = FOOTER_RULE_Y + 16;

const BODY_SIZE = 10.5;
const LINE = 14;
const GREY = rgb(0.42, 0.45, 0.5);
const INK = rgb(0.11, 0.13, 0.17);
const HAIRLINE = rgb(0.84, 0.86, 0.88);

const DEFAULT_RECORDS = [
  "Copies of the bookkeeping files and working papers for the current tax year.",
  "Previous year profit and loss and balance sheet ledgers, with a detailed breakdown.",
  "Current year's year-to-date trial balance, up to the date bookkeeping was completed.",
  "Detailed profit and loss and balance sheet, schedules, capital allowances record, director's loan account and details of s455 tax where relevant, for the last two tax years as filed with HMRC and Companies House.",
  "Copies of the director's last two years' personal tax returns, together with any P60s or P45s relevant to a return not yet filed.",
];

const TAX_REFERENCES = [
  "Company UTR.",
  "Companies House authentication code.",
  "VAT certificate and confirmation of the box 5 figure on the last filed VAT return.",
  "PAYE reference and Accounts Office reference number.",
  "Director's UTR and National Insurance number.",
];

const PAYROLL_ITEMS = [
  "Current year payroll up to the last filed RTI period, showing gross, tax, NI, employer NI and pension, together with staff details, P11 deductions workings and RTI filings.",
  "Copies of the previous two years' P60s and P45s, and a complete payroll report showing gross, tax, NI, employer NI and pension, as required for preparing the year-end accounts.",
  "Details of statutory payments such as SSP and SMP paid to employees.",
  "VAT returns submitted for the last four quarters, with a breakdown of input and output VAT and the respective net figures, where online software access is not provided.",
  "Copies of recent correspondence with HM Revenue & Customs and details of any outstanding matters.",
];

/** Standard fonts use WinAnsi: map typographic characters and drop anything else. */
function sanitize(text: string): string {
  return String(text ?? "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
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

  // Only the bodies this firm is registered with.
  const badges: PDFImage[] = [];
  for (const body of firm.regBodies ?? []) {
    const uri = BODY_BADGES[body.toUpperCase()];
    if (!uri) continue;
    const img = await embedDataUri(pdf, uri);
    if (img) badges.push(img);
  }

  let page!: PDFPage;
  let y = 0;

  const drawFurniture = (p: PDFPage) => {
    // ── Header ────────────────────────────────────────────────────────────────
    if (logo) {
      const w = (logo.width / logo.height) * LOGO_H;
      p.drawImage(logo, { x: MARGIN_X, y: LOGO_TOP - LOGO_H, width: w, height: LOGO_H });
    }
    const tagline = sanitize(firm.tagline ?? "Truly Professional");
    p.drawText(tagline, {
      x: PAGE_W - MARGIN_X - italic.widthOfTextAtSize(tagline, 11),
      y: TAGLINE_Y,
      size: 11,
      font: italic,
      color: accent,
    });
    // Practising registration, when the firm has one on file.
    const reg = firm.regNumber
      ? `${firm.regBody} Registration No. ${firm.regNumber}`
      : `Registered in England and Wales No. ${firm.companyNumber}`;
    p.drawText(sanitize(reg), {
      x: PAGE_W - MARGIN_X - font.widthOfTextAtSize(sanitize(reg), 7.5),
      y: REGLINE_Y,
      size: 7.5,
      font,
      color: GREY,
    });
    p.drawRectangle({ x: MARGIN_X, y: HEADER_RULE_Y, width: CONTENT_W, height: 1.6, color: accent });

    // ── Footer ────────────────────────────────────────────────────────────────
    p.drawRectangle({ x: MARGIN_X, y: FOOTER_RULE_Y, width: CONTENT_W, height: 0.6, color: HAIRLINE });
    if (badges.length) {
      const gap = 14;
      const sizes = badges.map((b) => ({ img: b, w: (b.width / b.height) * BADGE_H }));
      const total = sizes.reduce((sum, s) => sum + s.w, 0) + gap * (sizes.length - 1);
      let x = (PAGE_W - total) / 2;
      for (const s of sizes) {
        p.drawImage(s.img, { x, y: BADGE_Y, width: s.w, height: BADGE_H });
        x += s.w + gap;
      }
    }
    const lines = [
      `${firm.legalName}, Registered in England and Wales, Company Registration No: ${firm.companyNumber}`,
      `${firm.address}, ${firm.city}, ${firm.postcode}`,
      `t: ${firm.footerTel} | m: ${firm.footerMobile} | ${firm.email} | ${firm.website}`,
    ];
    lines.forEach((line, i) => {
      const t = sanitize(line);
      p.drawText(t, {
        x: (PAGE_W - font.widthOfTextAtSize(t, 7.2)) / 2,
        y: FOOTER_TEXT_Y - i * 9.5,
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

  const need = (height: number) => {
    if (y - height < BODY_BOTTOM) newPage();
  };

  const text = (
    value: string,
    opts: { font?: PDFFont; size?: number; color?: RGB; indent?: number; gap?: number } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? BODY_SIZE;
    const indent = opts.indent ?? 0;
    for (const line of wrap(value, f, size, CONTENT_W - indent)) {
      need(LINE);
      page.drawText(line, { x: MARGIN_X + indent, y, size, font: f, color: opts.color ?? INK });
      y -= LINE;
    }
    y -= opts.gap ?? 0;
  };

  // Numbered so the previous accountant can reply item by item ("re. 2.3").
  let sectionNo = 0;
  const section = (title: string) => {
    sectionNo += 1;
    need(LINE * 3);
    y -= 8;
    const label = `${sectionNo}.`;
    page.drawText(label, { x: MARGIN_X, y, size: 10.5, font: bold, color: accent });
    page.drawText(sanitize(title), { x: MARGIN_X + 18, y, size: 10.5, font: bold, color: accent });
    y -= 4;
    page.drawRectangle({ x: MARGIN_X, y: y + 2, width: CONTENT_W, height: 0.5, color: HAIRLINE });
    y -= LINE - 2;
    return 0;
  };

  const numbered = (items: string[]) => {
    items.forEach((item, i) => {
      const label = `${sectionNo}.${i + 1}`;
      const lines = wrap(item, font, BODY_SIZE, CONTENT_W - 34);
      need(LINE * Math.min(lines.length, 3));
      lines.forEach((line, li) => {
        need(LINE);
        if (li === 0) page.drawText(label, { x: MARGIN_X + 4, y, size: BODY_SIZE, font, color: accent });
        page.drawText(line, { x: MARGIN_X + 34, y, size: BODY_SIZE, font, color: INK });
        y -= LINE;
      });
    });
  };

  newPage();

  // ── Recipient ───────────────────────────────────────────────────────────────
  text("PRIVATE & CONFIDENTIAL", { font: bold, size: 9.5, color: accent, gap: 10 });
  text(prevFirmName, { font: bold });
  if (prevFirmAddress) {
    for (const line of prevFirmAddress.split(/\r?\n|,\s*/).map((s) => s.trim()).filter(Boolean)) {
      text(line);
    }
  }
  y -= 10;
  text(today, { color: GREY, gap: 12 });

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
    `We have been requested to act as accountants for the above${directorName ? " individual and company" : ""}. In connection with this, we are writing to enquire whether there are any professional reasons why we should not accept the appointment.`,
    { gap: 8 },
  );
  text(
    "Assuming there are no such matters, we should be grateful if you would provide the following information, whichever are relevant. Please quote the item number when replying.",
    { gap: 2 },
  );

  const selected = (docItems ?? []).map(itemLabel).filter(Boolean);

  section("Records and working papers");
  numbered(selected.length ? selected : DEFAULT_RECORDS);

  section("Online access and software");
  numbered([
    `MTD-compatible software - please send an invitation to ${firm.mtdEmail}.`,
    "HMRC and Companies House login details, if created on the client's behalf.",
    `NEST pension - please delegate access using Organisation Name: ${firm.nestOrgName}, Delegate Organisation ID: ${firm.nestDelegateId}.`,
  ]);

  section("Tax reference numbers and codes");
  numbered(TAX_REFERENCES);

  section("Payroll, RTI and pensions");
  numbered(PAYROLL_ITEMS);

  y -= 12;
  text("Thank you for your assistance in this matter, which will allow a smooth changeover.", { gap: 12 });

  // ── Signature ───────────────────────────────────────────────────────────────
  need(112);
  text("Yours faithfully,", { gap: 6 });
  if (signature) {
    const h = 40;
    const w = Math.min((signature.width / signature.height) * h, 180);
    need(h + 8);
    y -= h;
    page.drawImage(signature, { x: MARGIN_X, y, width: w, height: h });
    y -= 6;
  } else {
    y -= 28;
  }
  page.drawRectangle({ x: MARGIN_X, y: y + 6, width: 150, height: 0.6, color: HAIRLINE });
  y -= 4;
  text(partner, { font: bold, size: 11.5 });
  const designation = partner === firm.partnerName ? firm.partnerDesignation : firm.partnerDesignation2;
  if (designation) text(designation, { font: italic, size: 8.5, color: accent });
  y -= 2;
  text("Partner", { size: 9.5, color: INK });
  text(`For and on behalf of ${firm.legalName}`, { font: italic, size: 9, color: GREY });

  // Page numbers, once the total is known.
  const pages = pdf.getPages();
  if (pages.length > 1) {
    pages.forEach((p, i) => {
      const label = sanitize(`Page ${i + 1} of ${pages.length}`);
      p.drawText(label, {
        x: PAGE_W - MARGIN_X - font.widthOfTextAtSize(label, 7),
        y: FOOTER_RULE_Y + 6,
        size: 7,
        font,
        color: GREY,
      });
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/** Filename for the attachment, e.g. "Professional Clearance - Acme Ltd.pdf". */
export function clearancePdfFilename(clientName: string): string {
  const safe = sanitize(clientName).replace(/[\\/:*?"<>|]/g, "-").trim() || "Client";
  return `Professional Clearance - ${safe}.pdf`;
}
