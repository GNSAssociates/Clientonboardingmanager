/**
 * Professional clearance → Word (.docx) letter.
 *
 * Generates the formal clearance letter that is attached to the email sent to
 * the previous accountant: firm letterhead, the "any professional reasons"
 * question, the client & company details, and the list of information/records
 * required for a smooth handover. Pure-JS (docx) — runs on cPanel/serverless.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from "docx";
import type { FirmConfig } from "./firms";

export interface ClearanceDocInput {
  firm: FirmConfig;
  clientName: string;
  companyNumber?: string;
  directorName?: string;
  prevFirmName: string;
  prevFirmAddress?: string;
  /** Required items — strings or objects with a label/description. */
  docItems?: unknown[];
  today?: string;
}

const DEFAULT_ITEMS = [
  "Last set of approved statutory accounts",
  "Latest corporation tax computations and returns (CT600)",
  "Trial balance, nominal ledger and bookkeeping records",
  "VAT returns and supporting workings (if VAT registered)",
  "PAYE / payroll records (if applicable)",
  "Copies of relevant correspondence with HMRC",
  "Details of any ongoing matters, deadlines or disputes",
  "Access to the online accounting software (if applicable)",
];

function itemLabel(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    return String(o.label ?? o.title ?? o.name ?? o.description ?? "").trim();
  }
  return "";
}

function p(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacingAfter ?? 160 },
    children: [new TextRun({ text, bold: opts.bold })],
  });
}

export async function buildClearanceDocx(input: ClearanceDocInput): Promise<Buffer> {
  const {
    firm, clientName, companyNumber, directorName, prevFirmName, prevFirmAddress,
    docItems, today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  } = input;

  const items = (docItems && docItems.map(itemLabel).filter(Boolean).length)
    ? docItems.map(itemLabel).filter(Boolean)
    : DEFAULT_ITEMS;

  const children: Paragraph[] = [
    // Letterhead
    p(firm.legalName ?? firm.name, { bold: true, align: AlignmentType.RIGHT, spacingAfter: 20 }),
    ...(firm.email ? [p(firm.email, { align: AlignmentType.RIGHT, spacingAfter: 20 })] : []),
    ...(firm.phone ? [p(firm.phone, { align: AlignmentType.RIGHT, spacingAfter: 240 })] : []),
    // Date + recipient
    p(today, { spacingAfter: 240 }),
    p(prevFirmName, { bold: true, spacingAfter: 20 }),
    ...(prevFirmAddress ? [p(prevFirmAddress, { spacingAfter: 240 })] : [p("", { spacingAfter: 120 })]),
    // Subject
    p(
      `Re: Professional Clearance — ${clientName}${companyNumber ? ` (Company No. ${companyNumber})` : ""}`,
      { bold: true, spacingAfter: 240 },
    ),
    // Body
    p("Dear Sirs,"),
    p(
      `We have been asked to act as accountants for ${clientName}${companyNumber ? ` (Company No. ${companyNumber})` : ""}${directorName ? `, whose director is ${directorName}` : ""}. ` +
      `Before accepting this appointment we should be grateful if you would advise whether there are any professional reasons why we should not act.`,
    ),
    p(
      "Assuming there are no such reasons, we should be grateful if you would provide the following information and records so that we can ensure a smooth handover:",
    ),
    // Required items
    ...items.map((label) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: label })],
      }),
    ),
    p("", { spacingAfter: 80 }),
    p(
      "Please also confirm the basis on which the records will be transferred and advise of any fees outstanding, which the client will settle with you directly.",
    ),
    p("We thank you in advance for your assistance in ensuring a smooth changeover."),
    p("Yours faithfully,", { spacingAfter: 240 }),
    p(firm.legalName ?? firm.name, { bold: true }),
  ];

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
}

/** A safe filename for the attachment. */
export function clearanceDocFilename(clientName: string): string {
  const safe = (clientName || "Client").replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
  return `Professional_Clearance_${safe}.docx`;
}
