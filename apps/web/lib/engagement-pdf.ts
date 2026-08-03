/**
 * Engagement letter → PDF, built with pdf-lib.
 *
 * Modelled directly on clearance-pdf.ts (page geometry, wrap()/sanitize()/
 * embedDataUri()/hexToRgb() helpers, the repeating letterhead header and
 * practice-details footer, the badge row, and the partner signature block).
 * pdf-lib is used because it is the only PDF engine that loads on the cPanel /
 * Passenger host — @react-pdf/renderer (lib/letter-pdf.tsx) does not.
 *
 * Content is sourced from the existing HTML letter engine so the legal text
 * stays byte-for-byte identical to what clients already see and sign:
 *   - lib/letter-html.ts        — LetterData, fee maths, scope rows, the
 *                                  intro/closing override text, and the
 *                                  hardcoded body clauses (copied verbatim
 *                                  below, since they live inline in the HTML
 *                                  template rather than in a reusable export).
 *   - lib/terms-of-business.ts  — buildTermsOfBusinessHtml / buildPrivacyNoticeHtml
 *   - lib/service-schedules.ts  — buildSchedulesHtml (per-service schedules)
 * Those HTML-returning functions are called as-is and their output is run
 * through htmlToBlocks() (a tiny tag-stripping parser) rather than
 * re-typed — this guarantees the wording matches the HTML letter exactly.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import type { FirmConfig } from "./firms";
import {
  CLIENT_TYPE_TERMS,
  scopeRowsForServices,
  type LetterData,
  type LetterService,
} from "./letter-html";
import { renderVars, templateDef } from "./email-templates-lib";
import { buildSchedulesHtml } from "./service-schedules";
import { buildTermsOfBusinessHtml, buildPrivacyNoticeHtml } from "./terms-of-business";
import { GNS_LOGO_DATA_URI, GNS_SIGNATURE_DATA_URI } from "./brand-assets";
import { SG_SIGNATURE_DATA_URI } from "./sg-signature";
import { MG_SIGNATURE_DATA_URI } from "./mg-signature";
import { ACCA_LOGO_DATA_URI } from "./acca-logo";
import { ICAEW_LOGO_DATA_URI } from "./icaew-logo";
import { CIOT_LOGO_DATA_URI } from "./ciot-logo";
import { fmtGBP as gbp } from "./format";

const PARTNER_SIGNATURES: Record<string, string> = {
  "Lekh Nath Ghimire": GNS_SIGNATURE_DATA_URI,
  "Subash Ghimire": SG_SIGNATURE_DATA_URI,
  "Mahesh Giri": MG_SIGNATURE_DATA_URI,
};

const PARTNER_DESIGNATIONS: Record<string, string> = {
  "Lekh Nath Ghimire": "ACCA, MBA, ICAEW (ACA), CIOT",
  "Subash Ghimire": "ACCA, MBA",
  "Mahesh Giri": "ACCA, MA",
};

const BODY_BADGES: Record<string, string> = {
  ACCA: ACCA_LOGO_DATA_URI,
  ICAEW: ICAEW_LOGO_DATA_URI,
  CIOT: CIOT_LOGO_DATA_URI,
};

// ── Page geometry (A4, in points) — same as clearance-pdf.ts ─────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 52;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const LOGO_TOP = PAGE_H - 28;
const LOGO_H = 32;
const TAGLINE_Y = PAGE_H - 44;
const REGLINE_Y = PAGE_H - 57;
const HEADER_RULE_Y = PAGE_H - 70;
const BODY_TOP = PAGE_H - 96;

const FOOTER_RULE_Y = 70;
const BADGE_H = 14;
const FOOTER_TEXT_Y = 39;
const BODY_BOTTOM = FOOTER_RULE_Y + 16;

// Client requirement 1: warm cream/ivory page background on every page,
// drawn first (behind everything). Single named const so it's easy to change.
const CREAM_BG = rgb(0xfb / 255, 0xf8 / 255, 0xf1 / 255);

const BODY_SIZE = 11;
const LINE = 14.5;
const SMALL_LINE = 12.5;
const GREY = rgb(0.42, 0.45, 0.5);
const INK = rgb(0.11, 0.13, 0.17);
const HAIRLINE = rgb(0.8, 0.78, 0.72);
const TABLE_HEAD_BG = rgb(0.1, 0.12, 0.16);
const TABLE_ALT_BG = rgb(0.94, 0.91, 0.85);
const TABLE_TOTAL_BG = rgb(0.9, 0.87, 0.79);

/** Standard fonts use WinAnsi: map typographic characters and drop anything else. */
function sanitize(text: string): string {
  return String(text ?? "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
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

// ── Minimal HTML → block parser ───────────────────────────────────────────────
// The terms-of-business / privacy-notice / service-schedule content is only
// ever emitted as h1/h2/h3/p/li tags (plus inline <strong>/<em> which we flatten
// to plain text for pdf-lib). This keeps the wording byte-identical to the HTML
// letter without re-typing thousands of words of legal copy.
type Block = { type: "h1" | "h2" | "h3" | "p" | "li"; text: string };

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘");
}

function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const re = /<(h1|h2|h3|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const type = m[1]!.toLowerCase() as Block["type"];
    const inner = decodeEntities(m[2]!.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (inner) blocks.push({ type, text: inner });
  }
  return blocks;
}

export interface EngagementPdfInput extends LetterData {}

export async function buildEngagementPdf(input: EngagementPdfInput): Promise<Buffer> {
  const d = input;
  const f: FirmConfig = d.firm;
  const partner = d.partnerName?.trim() || f.partnerName;
  const regBody = d.regBody || f.regBody;
  const isManual = d.paymentMethod === "manual";
  const showAnnexA = d.includeAnnexA !== false;
  const terms = CLIENT_TYPE_TERMS[d.clientType ?? "limited"] ?? CLIENT_TYPE_TERMS.limited!;
  const accent = hexToRgb(f.accentColor);

  const docVars = { actFor: terms.actFor, companyName: d.companyName, firmName: f.name };
  const introText = renderVars(d.introOverrideHtml || templateDef("doc_engagement_intro")!.defaultBody, docVars);
  const closingText = renderVars(d.closingOverrideHtml || templateDef("doc_engagement_closing")!.defaultBody, docVars);

  // ── Fee maths — identical to buildLetterHtml() in letter-html.ts ───────────
  const monthly = d.services.filter((s) => !s.oneoff);
  const oneoff = d.services.filter((s) => s.oneoff);
  const customFees = (d.customFees ?? []).filter((c) => c.description.trim());
  const svcToMonthly = (s: LetterService) => {
    if (s.frequency === "annually") return s.price / 12;
    if (s.frequency === "quarterly") return s.price / 3;
    return s.price;
  };
  const svcToAnnual = (s: LetterService) => {
    if (s.frequency === "annually") return s.price;
    if (s.frequency === "quarterly") return s.price * 4;
    return s.price * 12;
  };
  const totalMonthly = monthly.reduce((s, x) => s + svcToMonthly(x), 0);
  const totalAnnual = monthly.reduce((s, x) => s + svcToAnnual(x), 0);
  const totalOneoff = oneoff.reduce((s, x) => s + x.price, 0) + customFees.reduce((s, x) => s + x.price, 0);

  const monthlyIds = monthly.map((s) => s.id ?? "");
  // Coverage/threshold text only — NEVER a chargeable fee, never in the totals above.
  const scopeRows = scopeRowsForServices(monthlyIds, d.scopeRows);

  const schedulesHtml = buildSchedulesHtml({
    serviceIds: monthlyIds,
    hasOneoff: oneoff.length > 0 || customFees.length > 0,
    firmName: f.name,
    regBody: f.regBody,
  });
  const tobOpts = { firmName: f.name, firmLegalName: f.legalName, firmAddress: `${f.address}, ${f.city} ${f.postcode}`, regBody, firmEmail: f.email };
  const termsHtml = buildTermsOfBusinessHtml(tobOpts);
  const privacyHtml = buildPrivacyNoticeHtml({ ...tobOpts, companyNumber: f.companyNumber });

  // ── Document setup ──────────────────────────────────────────────────────────
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Engagement Letter - ${sanitize(d.companyName)}`);
  pdf.setAuthor(f.legalName);
  pdf.setSubject("Letter of Engagement — Contract for Services");
  pdf.setProducer(f.legalName);
  pdf.setCreationDate(new Date());

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const logo = await embedDataUri(pdf, GNS_LOGO_DATA_URI);
  const signature = await embedDataUri(pdf, PARTNER_SIGNATURES[partner] ?? GNS_SIGNATURE_DATA_URI);

  const badgeByBody = new Map<string, PDFImage>();
  for (const body of f.regBodies ?? []) {
    const uri = BODY_BADGES[body.toUpperCase()];
    if (!uri) continue;
    const img = await embedDataUri(pdf, uri);
    if (img) badgeByBody.set(body.toUpperCase(), img);
  }

  let page!: PDFPage;
  let y = 0;

  const drawFurniture = (p: PDFPage) => {
    // Client requirement 1: cream background, drawn first, behind everything.
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM_BG });

    // ── Header ──────────────────────────────────────────────────────────────
    if (logo) {
      const w = (logo.width / logo.height) * LOGO_H;
      p.drawImage(logo, { x: MARGIN_X, y: LOGO_TOP - LOGO_H, width: w, height: LOGO_H });
    }
    const tagline = sanitize(f.tagline ?? "Truly Professional");
    p.drawText(tagline, {
      x: PAGE_W - MARGIN_X - italic.widthOfTextAtSize(tagline, 11),
      y: TAGLINE_Y,
      size: 11,
      font: italic,
      color: accent,
    });
    const reg = f.regNumber ? `${f.regNumberLabel ?? f.regBody} Registration No. ${f.regNumber}` : `Registered in England and Wales No. ${f.companyNumber}`;
    p.drawText(sanitize(reg), {
      x: PAGE_W - MARGIN_X - font.widthOfTextAtSize(sanitize(reg), 7.5),
      y: REGLINE_Y,
      size: 7.5,
      font,
      color: GREY,
    });
    p.drawRectangle({ x: MARGIN_X, y: HEADER_RULE_Y, width: CONTENT_W, height: 1.6, color: accent });

    // ── Footer ──────────────────────────────────────────────────────────────
    p.drawRectangle({ x: MARGIN_X, y: FOOTER_RULE_Y, width: CONTENT_W, height: 0.6, color: HAIRLINE });

    // Contact / registration text — centred (wording unchanged). GNS Ltd / Galaxy
    // show the fax on the contact line; the LLP shows the mobile.
    const contact = f.footerShowFax && f.footerFax
      ? `t: ${f.footerTel} | f: ${f.footerFax} | e: ${f.email} | ${f.website}`
      : `t: ${f.footerTel} | m: ${f.footerMobile} | e: ${f.email} | ${f.website}`;
    const lines = [
      `${f.legalName}, Registered in England and Wales, Company Registration No: ${f.companyNumber}`,
      `${f.address}, ${f.city}, ${f.postcode}`,
      contact,
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

    // Professional-body membership logos flank the footer text (client spec):
    // Ltd / Galaxy show ICAEW + ACCA on the left and CIOT on the right; the LLP
    // shows ACCA on the left. Membership is per-entity via f.regBodies.
    const SIDE_H = BADGE_H + 3;
    const midY = FOOTER_TEXT_Y - 9.5; // vertical centre of the 3 text lines
    const drawGroup = (imgs: PDFImage[], side: "left" | "right") => {
      if (!imgs.length) return;
      const gap = 8;
      const sized = imgs.map((im) => ({ im, w: (im.width / im.height) * SIDE_H }));
      const total = sized.reduce((s, x) => s + x.w, 0) + gap * (sized.length - 1);
      let x = side === "left" ? MARGIN_X : PAGE_W - MARGIN_X - total;
      for (const s of sized) {
        p.drawImage(s.im, { x, y: midY - SIDE_H / 2, width: s.w, height: SIDE_H });
        x += s.w + gap;
      }
    };
    const left: PDFImage[] = [];
    const right: PDFImage[] = [];
    const icaew = badgeByBody.get("ICAEW");
    const acca = badgeByBody.get("ACCA");
    const ciot = badgeByBody.get("CIOT");
    if (icaew) left.push(icaew);
    if (acca) left.push(acca);
    if (ciot) right.push(ciot);
    drawGroup(left, "left");
    drawGroup(right, "right");
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
    opts: { font?: PDFFont; size?: number; color?: RGB; indent?: number; gap?: number; align?: "left" | "center" | "right" } = {},
  ) => {
    const fnt = opts.font ?? font;
    const size = opts.size ?? BODY_SIZE;
    const indent = opts.indent ?? 0;
    const lines = wrap(value, fnt, size, CONTENT_W - indent);
    for (const line of lines) {
      need(LINE);
      let x = MARGIN_X + indent;
      if (opts.align === "center") x = (PAGE_W - fnt.widthOfTextAtSize(line, size)) / 2;
      else if (opts.align === "right") x = PAGE_W - MARGIN_X - fnt.widthOfTextAtSize(line, size);
      page.drawText(line, { x, y, size, font: fnt, color: opts.color ?? INK });
      y -= LINE;
    }
    y -= opts.gap ?? 0;
  };

  const bullet = (value: string) => {
    const indent = 16;
    const lines = wrap(value, font, BODY_SIZE, CONTENT_W - indent);
    lines.forEach((line, i) => {
      need(LINE);
      if (i === 0) page.drawText("•", { x: MARGIN_X, y, size: BODY_SIZE, font, color: accent });
      page.drawText(line, { x: MARGIN_X + indent, y, size: BODY_SIZE, font, color: INK });
      y -= LINE;
    });
  };

  let clauseNo = 0;
  const heading1 = (value: string) => {
    need(LINE * 2.5);
    y -= 6;
    const t = sanitize(value).toUpperCase();
    page.drawText(t, { x: (PAGE_W - bold.widthOfTextAtSize(t, 14)) / 2, y, size: 14, font: bold, color: INK });
    y -= LINE * 1.4;
  };
  const heading2 = (value: string, numbered = true) => {
    need(LINE * 2.5);
    y -= 6;
    clauseNo += 1;
    const label = numbered ? `${clauseNo}. ` : "";
    const t = sanitize(label + value);
    page.drawText(t, { x: MARGIN_X, y, size: 12, font: bold, color: accent });
    y -= 3;
    page.drawRectangle({ x: MARGIN_X, y: y - 2, width: CONTENT_W, height: 0.6, color: HAIRLINE });
    y -= LINE;
  };
  const heading3 = (value: string) => {
    need(LINE * 2);
    y -= 4;
    text(value, { font: bold, size: BODY_SIZE + 0.5, color: INK, gap: 2 });
  };

  const renderBlocks = (blocks: Block[]) => {
    for (const b of blocks) {
      if (b.type === "h1") heading1(b.text);
      else if (b.type === "h2") heading2(b.text);
      else if (b.type === "h3") heading3(b.text);
      else if (b.type === "li") bullet(b.text);
      else text(b.text, { gap: 6 });
    }
  };

  // ── Table drawing ────────────────────────────────────────────────────────
  interface Cell { text: string; bold?: boolean; color?: RGB; align?: "left" | "right" }
  interface Col { header: string; width: number; align?: "left" | "right" }
  const drawTable = (cols: Col[], rows: Cell[][], opts: { rowBg?: (i: number) => RGB | null; fontSize?: number } = {}) => {
    const size = opts.fontSize ?? 9.5;
    const pad = 6;
    // Header
    need(20);
    page.drawRectangle({ x: MARGIN_X, y: y - 16, width: CONTENT_W, height: 18, color: TABLE_HEAD_BG });
    let x = MARGIN_X;
    cols.forEach((c) => {
      const t = sanitize(c.header);
      const tx = c.align === "right" ? x + c.width - pad - bold.widthOfTextAtSize(t, size) : x + pad;
      page.drawText(t, { x: tx, y: y - 12, size, font: bold, color: rgb(1, 1, 1) });
      x += c.width;
    });
    y -= 20;

    rows.forEach((row, ri) => {
      const wrapped = row.map((cell, ci) => wrap(cell.text, cell.bold ? bold : font, size, cols[ci]!.width - pad * 2));
      const maxLines = Math.max(1, ...wrapped.map((w) => w.length));
      const rowH = maxLines * SMALL_LINE + 6;
      need(rowH + 4);
      const bg = opts.rowBg?.(ri);
      if (bg) page.drawRectangle({ x: MARGIN_X, y: y - rowH + 4, width: CONTENT_W, height: rowH, color: bg });
      let cx = MARGIN_X;
      row.forEach((cell, ci) => {
        const col = cols[ci]!;
        const lines = wrapped[ci]!;
        const fnt = cell.bold ? bold : font;
        lines.forEach((line, li) => {
          const ty = y - 10 - li * SMALL_LINE;
          const align = cell.align ?? col.align ?? "left";
          const tx = align === "right" ? cx + col.width - pad - fnt.widthOfTextAtSize(line, size) : cx + pad;
          page.drawText(line, { x: tx, y: ty, size, font: fnt, color: cell.color ?? INK });
        });
        cx += col.width;
      });
      y -= rowH;
      page.drawRectangle({ x: MARGIN_X, y, width: CONTENT_W, height: 0.5, color: HAIRLINE });
    });
    y -= 10;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — letterhead furniture, title, parties, fees
  // ═══════════════════════════════════════════════════════════════════════
  newPage();

  text("PRIVATE & CONFIDENTIAL", { font: bold, size: 9, color: accent });
  text(`Date: ${d.dateStr}`, { color: GREY, gap: 10, align: "right" });

  heading1("Letter of Engagement");
  text("Contract for Services", { font: italic, size: 12, color: accent, align: "center", gap: 14 });

  text("Between", { font: bold, size: 8.5, color: GREY, gap: 2 });
  text(`${f.legalName.toUpperCase()} of ${f.address}, ${f.city} ${f.postcode} ('The Accountants')`, { gap: 8 });
  text("And", { font: bold, size: 8.5, color: GREY, gap: 2 });
  const clientLine = `${d.companyName.toUpperCase()}${d.clientAddress ? ` of ${d.clientAddress}` : ""}${d.companyNumber ? ` (Company No. ${d.companyNumber})` : ""} ('The Client')`;
  text(clientLine, { font: bold, gap: 6 });
  text("This fee structure and quotation is an integral part of the engagement letter.", { font: italic, size: 9.5, color: GREY, align: "center", gap: 14 });

  if (d.ch && d.ch.number) {
    text("Company Details — verified with Companies House", { font: bold, size: 9, color: INK, gap: 4 });
    text(`Company No: ${d.ch.number}`, { size: 9.5, gap: 1 });
    if (d.ch.status) text(`Status: ${d.ch.status}`, { size: 9.5, gap: 1 });
    if (d.ch.address) text(`Registered Office: ${d.ch.address}`, { size: 9.5, gap: 1 });
    if (d.ch.incorporationDate) text(`Incorporated: ${new Date(d.ch.incorporationDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, { size: 9.5, gap: 1 });
    if (d.ch.aaDue) text(`Accounts due: ${new Date(d.ch.aaDue).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, { size: 9.5, gap: 1 });
    if (d.ch.csDue) text(`Confirmation statement due: ${new Date(d.ch.csDue).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, { size: 9.5, gap: 10 });
    else y -= 8;
  }

  // ── Fees — requirement 2: monthly recurring fees and one-off fees are two
  // strictly separate tables/totals. Neither table includes the "References
  // and Letters" scope row (that lives only in the Scope of Services table
  // below, and is display-only coverage text, never a charge).
  const payModeLabel = isManual ? "Monthly Invoice (manual)" : "Monthly Direct Debit";
  heading2("Fees", false);
  text(`Payment mode: ${payModeLabel}`, { font: bold, size: 9.5, color: accent, gap: 8 });

  if (monthly.length) {
    const freqLabel = (fr?: LetterService["frequency"]) => (fr === "annually" ? " (annual)" : fr === "quarterly" ? " (quarterly)" : "");
    drawTable(
      [
        { header: "Recurring Service (Monthly Fees)", width: CONTENT_W - 180 },
        { header: "Monthly £", width: 90, align: "right" },
        { header: "Annual Equivalent £", width: 90, align: "right" },
      ],
      [
        ...monthly.map((s) => [
          { text: `${s.name}${freqLabel(s.frequency)}` },
          { text: gbp(svcToMonthly(s)), align: "right" as const },
          { text: gbp(svcToAnnual(s)), align: "right" as const },
        ]),
        [
          { text: "Total monthly fee", bold: true },
          { text: gbp(totalMonthly), bold: true, align: "right" as const },
          { text: "", bold: true },
        ],
        [
          { text: "Total annual equivalent", bold: true },
          { text: "", bold: true },
          { text: gbp(totalAnnual), bold: true, align: "right" as const },
        ],
      ],
      { rowBg: (i) => (i >= monthly.length ? TABLE_TOTAL_BG : i % 2 ? TABLE_ALT_BG : null) },
    );
  } else {
    text("No monthly recurring services on this engagement.", { font: italic, size: 9.5, color: GREY, gap: 10 });
  }

  const oneoffItems = [...oneoff.map((s) => ({ name: s.name, price: s.price })), ...customFees.map((c) => ({ name: c.description, price: c.price }))];
  if (oneoffItems.length) {
    heading2("One-off / Upfront Fees", false);
    text("Payable upfront — never added into the monthly or annual totals above.", { font: italic, size: 9, color: GREY, gap: 6 });
    drawTable(
      [
        { header: "One-off Item", width: CONTENT_W - 110 },
        { header: "Amount £", width: 110, align: "right" },
      ],
      [
        ...oneoffItems.map((s) => [{ text: s.name }, { text: gbp(s.price), align: "right" as const }]),
        [{ text: "Total one-off (payable upfront)", bold: true }, { text: gbp(totalOneoff), bold: true, align: "right" as const }],
      ],
      { rowBg: (i) => (i >= oneoffItems.length ? TABLE_TOTAL_BG : i % 2 ? TABLE_ALT_BG : null) },
    );
  }
  text("Note: 20% VAT applies to all fees above. The monthly/annual figures and the one-off figure are separate totals — they are not added together.", { font: italic, size: 8.5, color: GREY, gap: 10 });

  if (isManual) {
    text("Payment — Monthly Invoice", { font: bold, size: 9.5, color: INK, gap: 2 });
    text("The Client's fees are invoiced monthly and are payable within 14 days of the invoice date. Fees for one-off and ad-hoc work are invoiced on completion and payable upfront. No Direct Debit mandate is required for this engagement.", { size: 9.5, gap: 10 });
  } else {
    text("Direct Debit — GoCardless Mandate", { font: bold, size: 9.5, color: INK, gap: 2 });
    text(`The Client's fees are collected by GoCardless Direct Debit. By signing this contract the Client authorises ${f.name} to collect fees using GoCardless direct debit and authorises the use of the bank details provided at signing for direct debit setup on the Client's behalf. Payments are protected by the Direct Debit Guarantee.`, { size: 9.5, gap: 10 });
  }

  text("Important! Please read the contract to the last page and return to the signature section. Do not sign unless you have read and understood the contract in its entirety.", { font: bold, size: 9.5, color: accent, gap: 12 });

  text("Services not covered below will be as per our Schedule of Service Charges (SSC) included in Annex A of this contract (last page).", { font: bold, size: 9, gap: 4 });
  if (scopeRows.length) {
    drawTable(
      [
        { header: "Scope of Services", width: CONTENT_W * 0.32 },
        { header: "Coverage Threshold", width: CONTENT_W * 0.36 },
        { header: "Fee Exceeding Scope", width: CONTENT_W * 0.32 },
      ],
      scopeRows.map((r) => [{ text: r.service, bold: true }, { text: r.threshold }, { text: r.excess }]),
      { rowBg: (i) => (i % 2 ? TABLE_ALT_BG : null), fontSize: 9 },
    );
  }

  need(LINE);
  page.drawRectangle({ x: MARGIN_X, y, width: CONTENT_W, height: 0.6, color: HAIRLINE });
  y -= 14;

  // ═══════════════════════════════════════════════════════════════════════
  // Main letter body — clauses copied verbatim from buildLetterHtml()
  // ═══════════════════════════════════════════════════════════════════════
  text(terms.principals, { font: bold, gap: 1 });
  text(d.clientName || d.companyName, { font: bold, gap: 1 });
  if (d.utr) text(`UTR: ${d.utr}`, { size: 9.5, color: GREY, gap: 2 });
  text("Dear Sir/s", { gap: 8 });
  for (const p of introText.split(/<\/p>\s*<p>|<p>|<\/p>/i).map((s) => s.trim()).filter(Boolean)) {
    text(decodeEntities(p.replace(/<[^>]+>/g, "")), { gap: 8 });
  }
  const ethicsBody = regBody === "ICAEW"
    ? "Code of Ethics of the Institute of Chartered Accountants in England and Wales (ICAEW)"
    : "ethical guidelines of the Association of Chartered Certified Accountants (ACCA)";
  const ethicsLink = regBody === "ACCA" ? " or at www.accaglobal.com" : " or at www.icaew.com";
  text(`We are bound by the ${ethicsBody} and accept instructions to act for you on the basis that we will act in accordance with those ethical guidelines. A copy of these guidelines can be viewed at our offices on request${ethicsLink}.`, { gap: 10 });

  heading2("Period of engagement");
  text("This letter is effective from the date signed.", { gap: 6 });
  text("We will deal with matters arising in respect of periods prior to the above date as appropriate should there be any such requirement.", { gap: 8 });

  heading2("Scope of services to be provided");
  heading3("Our responsibility to you");
  text("We have set out the agreed scope and objectives of your instructions within this letter of engagement. Any subsequent changes will be discussed with you and where appropriate a new letter of engagement will be agreed. We shall proceed on the basis of the instructions we have received from you and will rely on you to tell us as soon as possible if anything occurs which renders any information previously given to us as incorrect or inaccurate. We shall not be responsible for any failure to advise or comment on any matter that falls outside the specific scope of your instructions. We cannot accept any responsibility for any event, loss or situation unless it is one against which it is the expressed purpose of these instructions to provide protection.", { gap: 8 });
  heading3("Your responsibility to us");
  text("The advice that we give can only be as good as the information on which it is based. In so far as that information is provided by you, or by third parties with your permission, your responsibility arises as soon as possible if any circumstances or facts alter, as any alteration may have a significant impact on the advice given. If the circumstances change therefore or your needs alter, advise us of the alteration as soon as possible in writing.", { gap: 8 });
  heading3("Statutory responsibilities");
  text("As directors of the company, you are required by statute to prepare accounts (financial statements) for each financial year, which give a true and fair view of the state of affairs of the company and of its profit or loss for that period. In preparing those accounts you must:", { gap: 4 });
  bullet("Select suitable accounting policies and then apply them consistently.");
  bullet("Make judgements and estimates that are reasonable and prudent.");
  bullet("Prepare the accounts on the going concern basis unless it is not appropriate to presume that the company will continue in business.");
  y -= 4;
  text("You have engaged us to prepare the accounts on your behalf.", { gap: 8 });
  text("It is your responsibility to keep proper accounting records that disclose with reasonable accuracy at any particular time the financial position of the company. It is also your responsibility to safeguard the assets of the company and to take reasonable steps for the prevention of and detection of fraud and other irregularities with an appropriate system of internal controls.", { gap: 8 });
  text("You are responsible for determining whether, in respect of the year concerned, the company meets the conditions for exemption from an audit set out in section 477 of the Companies Act 2006, and for determining whether, in respect of the year, the exemption is not available for any of the reasons set out in section 478 of the Companies Act 2006.", { gap: 8 });
  text("You are also responsible for making available to us, as and when required, all the company's accounting records and all other relevant records and related information, including minutes of management and shareholders' meetings.", { gap: 8 });
  text("You will also be responsible for:", { gap: 4 });
  bullet("Maintaining records of all receipts and payments of cash.");
  bullet("Maintaining records of invoices issued and received.");
  bullet("Reconciling balances monthly/annually with the bank statements.");
  bullet("Preparing details of the following at the year-end: stocks and work in progress; fixed assets; amounts owing to suppliers; amounts owing by customers; and accruals and prepayments.");
  y -= 4;
  text("Our work will not be an audit of the accounts in accordance with International Standards on Auditing (UK and Ireland). Accordingly, we shall not seek any independent evidence to support the entries in the accounting records, or to prove the existence, ownership or valuation of assets or completeness of income, liabilities or disclosure in the accounts. Nor shall we assess the reasonableness of any estimates or judgements made in the preparation of the accounts. Consequently, our work will not provide any assurance that the accounting records are free from material misstatement, irregularities or error.", { gap: 8 });
  text("As part of our normal procedures we may request you to provide written confirmation of any oral information and explanations given to us during the course of our work.", { gap: 8 });
  text("We have a professional duty to compile accounts that conform with generally accepted accounting principles. The accounts of a limited company are required to comply with the disclosure requirements of the Companies Act 2006 and applicable accounting standards. Where we identify that the accounts do not conform to accepted accounting principles or standards, we will inform you and suggest amendments be put through the accounts before being published. We have a professional responsibility not to allow our name to be associated with accounts that may be misleading. In extreme cases, where this matter cannot be resolved, we will withdraw from the engagement and notify you in writing of the reasons.", { gap: 8 });
  text("Should you instruct us to carry out any alternative report it will be necessary for us to issue a separate letter of engagement.", { gap: 8 });
  heading3("Our service to you");
  text("We will not be carrying out any audit work as part of this assignment and accordingly will not verify the assets and liabilities of the company, nor the items of expenditure and income. To carry out an audit would entail additional work to comply with International Standards on Auditing so that we could report on the truth and fairness of the financial statements. We would also like to emphasise that we cannot undertake to discover any shortcomings in your systems or irregularities on the part of your employees.", { gap: 8 });
  text("If an audit of the accounts is required, you will need to notify us in writing. Should our work indicate that the company is not entitled to exemption from an audit of the accounts, we will inform you. If we decide to undertake an audit assignment at your request, a separate engagement letter will be required.", { gap: 8 });
  text("We will attach to the accounts a report developed by the Consultative Committee of Accountancy Bodies (CCAB) which explains what work has been done by us, the professional requirements we have to fulfil and the standard to which the work has been carried out. To ensure that anyone reading the accounts is aware that we have not carried out an audit, we will attach to the accounts a report stating this fact.", { gap: 8 });
  text("The intended users of the report are the directors. The report will be addressed to the directors.", { gap: 8 });
  text("Once we have issued our report we have no further direct responsibility in relation to the accounts for that financial year. However, we expect that you will inform us of any material event occurring between the date of our report and that of the annual general meeting that may affect the accounts.", { gap: 8 });
  heading3("Limitation of liability");
  text("We specifically draw your attention to the limitation of liability paragraphs in our standard terms and conditions which set out the basis on which we limit our liability to you and to others. You should read this in conjunction with the limitation of third party rights paragraphs in our standard terms and conditions which exclude liability to third parties. These are important provisions which you should read and consider carefully.", { gap: 8 });
  text("There are no third parties that we have agreed should be entitled to rely on the work done pursuant to this engagement letter.", { gap: 8 });

  heading2("Other services");
  text("You may request that we provide other services from time to time. If these services will exceed £200, we will issue a separate letter of engagement and scope of work to be performed accordingly.", { gap: 8 });
  text("Because rules and regulations frequently change you must ask us to confirm any advice already given if a transaction is delayed or a similar transaction is to be undertaken.", { gap: 8 });

  heading2("Electronic signature");
  text("This contract is executed by electronic signature. In accordance with the Electronic Communications Act 2000, the Electronic Identification and Trust Services for Electronic Transactions Regulations 2016 (UK eIDAS) and the Law Commission's 2019 Statement on the Electronic Execution of Documents, an electronic signature (including a typed name entered with intent to sign) is legally valid and binding in England and Wales. By typing their name in the signature box and submitting, the signatory confirms their intention to be bound by this contract. A tamper-evident audit record (signatory, date and time, network address and document fingerprint) is retained with the signed copy, and a copy of the signed contract is provided to the Client for their records.", { gap: 8 });

  heading2("Data Protection");
  text("We comply with the provisions of the General Data Protection Regulation (GDPR) when processing personal data about you, your directors and employees and your/their family.", { gap: 6 });
  text("Processing means:", { gap: 4 });
  bullet("obtaining, recording or holding personal data; or");
  bullet("carrying out any operation or set of operations on personal data, including collecting and storage, organising, adapting, altering, using, disclosure (by any means) or removing (by any means) from the records manual and digital.");
  y -= 4;
  text("The information we obtain, process, use and disclose will be necessary for:", { gap: 4 });
  bullet("the performance of the contract");
  bullet("to comply with our legal and regulatory compliance and crime prevention");
  bullet("contacting you with details of other services where you have consented to us doing so");
  bullet("other legitimate interests relating to protection against potential claims and disciplinary action against us.");
  y -= 4;
  text("This includes, but is not limited to, purposes such as updating and enhancing our client records, analysis for management purposes and statutory returns.", { gap: 8 });
  text(`In regard to our professional obligations we are a member firm of the ${regBody}. Under the ethical and regulatory rules of ${regBody}, we are required to allow access to client files and records for the purpose of maintaining our membership of this body.`, { gap: 8 });
  text("Further details on the processing of data are contained in our privacy notice, which should be read alongside these terms and conditions.", { gap: 8 });
  heading3("Requirements of the Data Protection Act (DPA) 2018 and the General Data Protection Regulation (GDPR)");
  text("The DPA 2018 and GDPR set out a number of requirements in relation to the processing of personal data.", { gap: 8 });
  text(`Here at ${f.name}, we take your privacy and the privacy of the information we process seriously. We will only use your personal information and the personal information you give us access to under this contract to administer your account and to provide the services you have requested from us. Bank details provided for the Direct Debit mandate are used solely for that purpose and are transmitted securely to our payment provider.`, { gap: 8 });
  heading3("(a) Continuity arrangements");
  text("Please note that we have arrangements in place for an alternate to deal with matters in the event of permanent incapacity or illness. This provides protection to you in the event that we cannot act on your behalf, and in signing this letter you agree to the alternate having access to all of the information we hold in order to make initial contact with you and agree the work to be undertaken during any incapacity. You can choose to appoint another agent at that stage if you wish.", { gap: 8 });
  heading3("(b) Secure communications and transfer of data");
  text("We will communicate or transfer data using the following:", { gap: 4 });
  bullet("Post/hard-copy documents [by normal or recorded delivery]");
  bullet("Password-protected attachments in emails");
  bullet("Encrypted emails");
  bullet("Secure cloud-based software for electronic signature");
  bullet("Emails *");
  bullet("Social media - Text, Viber, Whatsapp");
  y -= 4;
  text("* If you require us to correspond with you by email that is not encrypted or password protected, you also accept the risks associated with this form of communication.", { gap: 8 });
  heading3("(c) Other services — contact preferences");
  text("From time to time we would like to contact you with details of other services we provide. Your chosen contact preferences are recorded in the acceptance section of this contract.", { gap: 8 });

  heading2("Agreement of terms");
  for (const p of closingText.split(/<\/p>\s*<p>|<p>|<\/p>/i).map((s) => s.trim()).filter(Boolean)) {
    text(decodeEntities(p.replace(/<[^>]+>/g, "")), { gap: 8 });
  }

  // ── Signature ────────────────────────────────────────────────────────────
  need(120);
  text("Yours sincerely,", { gap: 6 });
  if (signature) {
    const h = 42;
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
  text(partner, { font: bold, size: 11.5, gap: 1 });
  if (PARTNER_DESIGNATIONS[partner]) text(PARTNER_DESIGNATIONS[partner]!, { font: italic, size: 9, color: accent, gap: 1 });
  text(`Partner, ${f.legalName}`, { size: 9.5, color: GREY, gap: 8 });
  text("I/We confirm that I/we have read and understood the contents of this letter and related terms and conditions and agree that it accurately reflects my/our fair understanding of the services that I/we require you to undertake.", { gap: 10 });

  need(LINE);
  page.drawRectangle({ x: MARGIN_X, y, width: CONTENT_W, height: 0.6, color: HAIRLINE });
  y -= 16;

  // ═══════════════════════════════════════════════════════════════════════
  // Schedule of services / Terms of business / Privacy notice — sourced from
  // the same functions the HTML letter uses, so the wording is verbatim.
  // ═══════════════════════════════════════════════════════════════════════
  heading1("Schedule of Services");
  text("This section provides a full explanation of the services you have engaged us to carry out, and should be read in conjunction with the engagement letter and the terms and conditions of business. Only the services listed in these schedules are included within the scope of our instructions.", { gap: 10 });
  renderBlocks(htmlToBlocks(schedulesHtml));

  y -= 6;
  need(LINE);
  page.drawRectangle({ x: MARGIN_X, y, width: CONTENT_W, height: 0.6, color: HAIRLINE });
  y -= 16;
  renderBlocks(htmlToBlocks(termsHtml));

  y -= 6;
  need(LINE);
  page.drawRectangle({ x: MARGIN_X, y, width: CONTENT_W, height: 0.6, color: HAIRLINE });
  y -= 16;
  renderBlocks(htmlToBlocks(privacyHtml));

  // ── Annex A — Schedule of Service Charges ──────────────────────────────────
  if (showAnnexA) {
    y -= 6;
    need(LINE);
    page.drawRectangle({ x: MARGIN_X, y, width: CONTENT_W, height: 0.6, color: HAIRLINE });
    y -= 16;
    heading2("Annex A: Schedule of Service Charges (SSC)", false);
    text("Ad-hoc and specialist services not included in your monthly fee are charged as follows:", { font: italic, size: 9, color: GREY, gap: 10 });

    text("Self-Assessment (SA) Tax Return (SATR)", { font: bold, size: 9.5, color: accent, gap: 4 });
    drawTable(
      [
        { header: "Service", width: CONTENT_W - 180 },
        { header: "Single", width: 90, align: "right" },
        { header: "Couple", width: 90, align: "right" },
      ],
      [
        ["Buy to Let SA Filing", "£250+VAT", "£350+VAT"],
        ["Director and other SA (Salary, Dividend)", "£200+VAT", "£375+VAT"],
        ["Sole Trader (Self Employed with GNS to do bookkeeping)", "£350+VAT", "NA"],
        ["Change of Beneficial Ownership for Rental Property Owners", "£500+VAT (New)", "£400+VAT (Existing)"],
      ].map(([a, b, c]) => [{ text: a! }, { text: b!, align: "right" as const }, { text: c!, align: "right" as const }]),
      { rowBg: (i) => (i % 2 ? TABLE_ALT_BG : null) },
    );

    text("MTD Filing for Self-Assessment and Annual Summary", { font: bold, size: 9.5, color: accent, gap: 4 });
    drawTable(
      [
        { header: "Service", width: CONTENT_W - 180 },
        { header: "Single", width: 90, align: "right" },
        { header: "Couple", width: 90, align: "right" },
      ],
      [
        ["Quarterly", "£75+VAT / quarter", "£150+VAT / quarter"],
        ["Annual Summary Filing", "Free", "Free"],
        ["BTL / SA Filing (same as above)", "£250+VAT", "£350+VAT"],
        ["Total Fee for SA Filing when MTD comes to full force", "£550+VAT", "£850+VAT"],
      ].map(([a, b, c]) => [{ text: a! }, { text: b!, align: "right" as const }, { text: c!, align: "right" as const }]),
      { rowBg: (i) => (i % 2 ? TABLE_ALT_BG : null) },
    );

    text("Compliance & Tax Registration Services", { font: bold, size: 9.5, color: accent, gap: 4 });
    drawTable(
      [
        { header: "Service", width: CONTENT_W - 300 },
        { header: "Companies House", width: 100, align: "right" },
        { header: "GNS Fee", width: 70, align: "right" },
        { header: "VAT", width: 60, align: "right" },
        { header: "Total", width: 70, align: "right" },
      ],
      [
        ["Company Registration", "£100.00", "£125.00", "£25.00", "£250.00"],
        ["Company Registration — Same Day", "£156.00", "£200.00", "£40.00", "£396.00"],
        ["Change of Name", "£20.00", "£75.00", "£15.00", "£110.00"],
        ["Same Day Change of Name", "£85.00", "£150.00", "£30.00", "£265.00"],
        ["Confirmation Statement Filing", "£50.00", "£50.00", "£10.00", "£110.00"],
        ["Voluntary Strike Off DS01", "£14.00", "£100.00", "£20.00", "£134.00"],
        ["Charge Registration", "£15.00", "£50.00", "£10.00", "£75.00"],
        ["Certificate of Good Standing", "£15.00", "£50.00", "£10.00", "£75.00"],
        ["Certificate of Good Standing — Express", "£50.00", "£75.00", "£15.00", "£140.00"],
        ["Shareholding Changes", "—", "£50.00", "£10.00", "£60.00"],
        ["Director Appointment / Termination", "—", "£50.00", "£10.00", "£60.00"],
        ["Company / Directors' Address Changes", "—", "£50.00", "£10.00", "£60.00"],
        ["Companies House Identity Verification", "—", "£75.00", "£15.00", "£90.00"],
        ["Reference Letters and Forms", "—", "£100.00", "£20.00", "£120.00"],
        ["PAYE Registration", "—", "£100.00", "£20.00", "£120.00"],
        ["VAT Registration", "—", "£75.00", "£15.00", "£90.00"],
        ["Self-Assessment Registration", "—", "£100.00", "£20.00", "£120.00"],
      ].map(([a, b, c, e, g]) => [{ text: a! }, { text: b!, align: "right" as const }, { text: c!, align: "right" as const }, { text: e!, align: "right" as const }, { text: g!, align: "right" as const }]),
      { rowBg: (i) => (i % 2 ? TABLE_ALT_BG : null), fontSize: 8.5 },
    );

    text("Subscription Based Services", { font: bold, size: 9.5, color: accent, gap: 4 });
    drawTable(
      [
        { header: "Service", width: CONTENT_W - 120 },
        { header: "Amount", width: 120, align: "right" },
      ],
      [
        ["Registered Office Address", "£20+VAT (Monthly)"],
        ["QuickBooks Subscription", "£25+VAT (Monthly)"],
      ].map(([a, b]) => [{ text: a! }, { text: b!, align: "right" as const }]),
      { rowBg: (i) => (i % 2 ? TABLE_ALT_BG : null) },
    );
  }

  need(LINE * 2);
  y -= 6;
  text(f.regStatement, { font: italic, size: 7.5, color: GREY, align: "center" });

  // Page numbers, once the total is known.
  const pages = pdf.getPages();
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

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/** Filename for the attachment, e.g. "Engagement Letter - Acme Ltd.pdf". */
export function engagementPdfFilename(companyName: string): string {
  const safe = sanitize(companyName).replace(/[\\/:*?"<>|]/g, "-").trim() || "Client";
  return `Engagement Letter - ${safe}.pdf`;
}
