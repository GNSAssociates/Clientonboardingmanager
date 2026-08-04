/**
 * Engagement letter → editable Word (.docx), built with the pure-JS `docx`
 * library (bundles cleanly in the cPanel standalone — no native deps).
 *
 * Reuses the SAME content sources as engagement-pdf.ts (intro/closing templates,
 * terms-of-business / privacy-notice / service-schedule HTML, and the identical
 * fee maths) so the Word copy matches the PDF wording. This is the firm's own
 * document, offered so staff can edit it in Word before sending.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  Header, Footer, ImageRun, PageNumber, TabStopType, TabStopPosition,
} from "docx";
import type { FirmConfig } from "./firms";
import { CLIENT_TYPE_TERMS, scopeRowsForServices, type LetterData, type LetterService } from "./letter-html";
import { renderVars, templateDef } from "./email-templates-lib";
import { buildSchedulesHtml } from "./service-schedules";
import { buildTermsOfBusinessHtml, buildPrivacyNoticeHtml } from "./terms-of-business";
import { fmtGBP as gbp } from "./format";
import { GNS_LOGO_DATA_URI } from "./brand-assets";
import { ACCA_LOGO_DATA_URI } from "./acca-logo";
import { ICAEW_LOGO_DATA_URI } from "./icaew-logo";
import { CIOT_LOGO_DATA_URI } from "./ciot-logo";

/** Decode a base64 PNG data URI to a Buffer + its pixel size (from the PNG header). */
function pngFromDataUri(uri: string): { data: Buffer; w: number; h: number } | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec((uri || "").trim());
  if (!m) return null;
  const data = Buffer.from(m[1]!, "base64");
  try { return { data, w: data.readUInt32BE(16), h: data.readUInt32BE(20) }; } catch { return null; }
}

/** An ImageRun scaled to a target height (px), preserving aspect ratio. */
function logoRun(uri: string, targetH: number): ImageRun | null {
  const png = pngFromDataUri(uri);
  if (!png) return null;
  const width = Math.round((png.w / png.h) * targetH);
  return new ImageRun({ data: new Uint8Array(png.data), transformation: { width, height: targetH } });
}

const BODY_BADGE_URIS: Record<string, string> = {
  ACCA: ACCA_LOGO_DATA_URI, ICAEW: ICAEW_LOGO_DATA_URI, CIOT: CIOT_LOGO_DATA_URI,
};

const NAVY = "1F3366";
const GREY = "6B7280";

type Block = { type: "h1" | "h2" | "h3" | "p" | "li"; text: string };
function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const re = /<(h1|h2|h3|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const type = m[1]!.toLowerCase() as Block["type"];
    const inner = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
      .replace(/\s+/g, " ").trim();
    if (inner) blocks.push({ type, text: inner });
  }
  return blocks;
}

function blocksToParagraphs(html: string): Paragraph[] {
  return htmlToBlocks(html).map((b) => {
    if (b.type === "h1") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } });
    if (b.type === "h2") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
    if (b.type === "h3") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } });
    if (b.type === "li") return new Paragraph({ text: b.text, bullet: { level: 0 }, spacing: { after: 60 } });
    return new Paragraph({ children: [new TextRun(b.text)], spacing: { after: 120 } });
  });
}

const P = (text: string, opts: { bold?: boolean; italics?: boolean; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; size?: number; after?: number } = {}) =>
  new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.after ?? 120 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size })],
  });

function feeCell(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({ alignment: opts.align, children: [new TextRun({ text, bold: opts.bold })] })],
  });
}

export function engagementDocxFilename(companyName: string): string {
  const safe = (companyName || "client").replace(/[\\/:*?"<>|]/g, "-").trim();
  return `Engagement Letter - ${safe}.docx`;
}

export async function buildEngagementDocx(input: LetterData): Promise<Buffer> {
  const d = input;
  const f: FirmConfig = d.firm;
  const partner = d.partnerName?.trim() || f.partnerName;
  const regBody = d.regBody || f.regBody;
  const terms = CLIENT_TYPE_TERMS[d.clientType ?? "limited"] ?? CLIENT_TYPE_TERMS.limited!;
  const dateStr = d.dateStr || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const docVars = { actFor: terms.actFor, companyName: d.companyName, firmName: f.name };
  const introText = renderVars(d.introOverrideHtml || templateDef("doc_engagement_intro")!.defaultBody, docVars);
  const closingText = renderVars(d.closingOverrideHtml || templateDef("doc_engagement_closing")!.defaultBody, docVars);

  // Fee maths — identical to engagement-pdf.ts / buildLetterHtml().
  const monthly = d.services.filter((s) => !s.oneoff);
  const oneoff = d.services.filter((s) => s.oneoff);
  const customFees = (d.customFees ?? []).filter((c) => c.description.trim());
  const svcToMonthly = (s: LetterService) => s.frequency === "annually" ? s.price / 12 : s.frequency === "quarterly" ? s.price / 3 : s.price;
  const svcToAnnual = (s: LetterService) => s.frequency === "annually" ? s.price : s.frequency === "quarterly" ? s.price * 4 : s.price * 12;
  const totalMonthly = monthly.reduce((s, x) => s + svcToMonthly(x), 0);
  const totalAnnual = monthly.reduce((s, x) => s + svcToAnnual(x), 0);
  const totalOneoff = oneoff.reduce((s, x) => s + x.price, 0) + customFees.reduce((s, x) => s + x.price, 0);
  const monthlyIds = monthly.map((s) => s.id ?? "");

  const schedulesHtml = buildSchedulesHtml({ serviceIds: monthlyIds, hasOneoff: oneoff.length > 0 || customFees.length > 0, firmName: f.name, regBody: f.regBody });
  const tobOpts = { firmName: f.name, firmLegalName: f.legalName, firmAddress: `${f.address}, ${f.city} ${f.postcode}`, regBody, firmEmail: f.email };
  const termsHtml = buildTermsOfBusinessHtml(tobOpts);
  const privacyHtml = buildPrivacyNoticeHtml({ ...tobOpts, companyNumber: f.companyNumber });

  const body: Paragraph[] = [];

  // Title block (the letterhead itself is the running header/footer below).
  body.push(P("PRIVATE & CONFIDENTIAL", { bold: true, color: NAVY, size: 18, after: 40 }));
  body.push(P(`Date: ${dateStr}`, { color: GREY, align: AlignmentType.RIGHT, size: 18, after: 160 }));
  body.push(new Paragraph({ text: "Letter of Engagement", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 40 } }));
  body.push(P("Contract for Services", { italics: true, color: NAVY, align: AlignmentType.CENTER, after: 200 }));

  // Parties
  body.push(P("Between", { bold: true, color: GREY, size: 18, after: 40 }));
  body.push(P(`${f.legalName} of ${f.address}, ${f.city} ${f.postcode} ('The Accountants')`, { after: 120 }));
  body.push(P("And", { bold: true, color: GREY, size: 18, after: 40 }));
  const clientLine = `${d.companyName ?? "The Client"}${d.clientAddress ? ` of ${d.clientAddress}` : ""}${d.companyNumber ? ` (Company No. ${d.companyNumber})` : ""} ('The Client')`;
  body.push(P(clientLine, { after: 200 }));

  // Intro
  body.push(...blocksToParagraphs(`<p>${introText.replace(/<\/p>\s*<p>/gi, "</p><p>")}</p>`.replace(/<p><p>/g, "<p>").replace(/<\/p><\/p>/g, "</p>")));

  // Fees
  const feeRows: TableRow[] = [
    new TableRow({ tableHeader: true, children: [feeCell("Service", { bold: true }), feeCell("Monthly", { bold: true, align: AlignmentType.RIGHT }), feeCell("Annual", { bold: true, align: AlignmentType.RIGHT })] }),
    ...monthly.map((s) => new TableRow({ children: [feeCell(s.name), feeCell(gbp(svcToMonthly(s)), { align: AlignmentType.RIGHT }), feeCell(gbp(svcToAnnual(s)), { align: AlignmentType.RIGHT })] })),
    new TableRow({ children: [feeCell("Total", { bold: true }), feeCell(gbp(totalMonthly), { bold: true, align: AlignmentType.RIGHT }), feeCell(gbp(totalAnnual), { bold: true, align: AlignmentType.RIGHT })] }),
  ];
  if (monthly.length) {
    body.push(new Paragraph({ text: "Fees", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
    body.push(new Paragraph({ children: [], spacing: { after: 0 } }));
    (body as (Paragraph | Table)[]).push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: feeRows,
      borders: { top: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" }, left: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" }, right: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" } } }));
    body.push(P("", { after: 120 }));
  }
  if (oneoff.length || customFees.length) {
    const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [feeCell("One-off / Upfront", { bold: true }), feeCell("Fee", { bold: true, align: AlignmentType.RIGHT })] })];
    for (const s of oneoff) rows.push(new TableRow({ children: [feeCell(s.name), feeCell(gbp(s.price), { align: AlignmentType.RIGHT })] }));
    for (const c of customFees) rows.push(new TableRow({ children: [feeCell(c.description), feeCell(gbp(c.price), { align: AlignmentType.RIGHT })] }));
    rows.push(new TableRow({ children: [feeCell("Total one-off", { bold: true }), feeCell(gbp(totalOneoff), { bold: true, align: AlignmentType.RIGHT })] }));
    body.push(new Paragraph({ text: "One-off / Upfront Fees", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 100 } }));
    (body as (Paragraph | Table)[]).push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
    body.push(P("", { after: 120 }));
  }

  // Standard body — schedules, terms of business, privacy notice
  body.push(...blocksToParagraphs(schedulesHtml));
  body.push(...blocksToParagraphs(termsHtml));
  body.push(...blocksToParagraphs(privacyHtml));

  // Closing + signature
  body.push(...blocksToParagraphs(`<p>${closingText.replace(/<\/p>\s*<p>/gi, "</p><p>")}</p>`.replace(/<p><p>/g, "<p>").replace(/<\/p><\/p>/g, "</p>")));
  body.push(P("Yours sincerely,", { after: 240 }));
  body.push(P(partner, { bold: true, after: 20 }));
  if (d.partnerName && PARTNER_DESIGNATIONS[partner]) body.push(P(PARTNER_DESIGNATIONS[partner]!, { italics: true, color: NAVY, size: 18, after: 20 }));
  body.push(P(`For and on behalf of ${f.legalName}`, { color: GREY, size: 18, after: 160 }));
  // ── Running header (logo + entity + reg) on every page ────────────────────
  const headerLogo = logoRun(GNS_LOGO_DATA_URI, 30);
  const regLabel = f.regNumber
    ? `${f.regNumberLabel ?? f.regBody} Registration No. ${f.regNumber}`
    : `Registered in England and Wales No. ${f.companyNumber}`;
  const header = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: { after: 30 },
        border: { bottom: { color: NAVY, size: 12, style: BorderStyle.SINGLE, space: 6 } },
        children: [
          ...(headerLogo ? [headerLogo] : []),
          new TextRun({ text: `\t${f.legalName}`, bold: true, color: NAVY, size: 24 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 20 },
        children: [new TextRun({ text: regLabel, size: 15, color: GREY, italics: true })],
      }),
    ],
  });

  // ── Running footer (body logos + practice details + page number) ──────────
  const badgeRuns = (f.regBodies ?? [])
    .map((b) => { const uri = BODY_BADGE_URIS[b.toUpperCase()]; return uri ? logoRun(uri, 15) : null; })
    .filter((r): r is ImageRun => r !== null);
  const badgeChildren: (ImageRun | TextRun)[] = [];
  badgeRuns.forEach((run, i) => { if (i > 0) badgeChildren.push(new TextRun({ text: "      " })); badgeChildren.push(run); });
  const contactLine = f.footerShowFax && f.footerFax
    ? `t: ${f.footerTel} | f: ${f.footerFax} | e: ${f.email} | ${f.website}`
    : `t: ${f.footerTel} | m: ${f.footerMobile} | e: ${f.email} | ${f.website}`;
  const footLine = (text: string) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, size: 14, color: GREY })] });
  const footer = new Footer({
    children: [
      ...(badgeRuns.length ? [new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 40 },
        border: { top: { color: "D1D5DB", size: 6, style: BorderStyle.SINGLE, space: 6 } },
        children: badgeChildren,
      })] : []),
      footLine(`${f.legalName}, Registered in England and Wales, Company Registration No: ${f.companyNumber}`),
      footLine(`${f.address}, ${f.city}, ${f.postcode}`),
      footLine(contactLine),
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { before: 40 },
        children: [
          new TextRun({ text: "Page ", size: 13, color: GREY }),
          new TextRun({ children: [PageNumber.CURRENT], size: 13, color: GREY }),
          new TextRun({ text: " of ", size: 13, color: GREY }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 13, color: GREY }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: f.legalName,
    title: `Engagement Letter - ${d.companyName ?? "client"}`,
    styles: {
      default: { document: { run: { font: "Calibri", size: 21 } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", run: { size: 40, bold: true, color: NAVY }, paragraph: { spacing: { after: 80 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { size: 30, bold: true, color: NAVY } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { size: 26, bold: true, color: NAVY } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", run: { size: 23, bold: true, color: NAVY } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1700, bottom: 1600, left: 1100, right: 1100, header: 560, footer: 480 } } },
      headers: { default: header },
      footers: { default: footer },
      children: body,
    }],
  });

  return await Packer.toBuffer(doc);
}

const PARTNER_DESIGNATIONS: Record<string, string> = {
  "Lekh Nath Ghimire": "ACCA, MBA, ICAEW (ACA), CIOT",
  "Subash Ghimire": "ACCA, MBA",
  "Mahesh Giri": "ACCA, MA",
};
