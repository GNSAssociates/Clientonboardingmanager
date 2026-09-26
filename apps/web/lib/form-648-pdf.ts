/**
 * HMRC form 64-8 (Authorising your agent), filled from the engagement record.
 *
 * We fill HMRC's genuine form rather than redrawing it. The template in
 * form-648-template.ts is the real PDF with a live AcroForm, so what the client
 * signs is the official document — not a facsimile that could drift from it.
 *
 * ONE SIGNATURE. The client signs the engagement letter once and that signature
 * is applied here, because the declaration they sign names this form and the
 * tax heads on it. That only holds while the contract wording and the ticks on
 * this form agree, so both are driven from the same `taxes` value — never set
 * one without the other.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { FirmConfig } from "./firms";
import { FORM_648_TEMPLATE_BASE64 } from "./form-648-template";

/** The tax heads a 64-8 can authorise. Field names are HMRC's, not ours. */
export interface Form648Taxes {
  /** Self Assessment (individual). */
  sa: boolean;
  /** Partnership Self Assessment. */
  partnership: boolean;
  /** Trust. */
  trust: boolean;
  /** Corporation Tax. */
  corpTax: boolean;
  /** Individual PAYE / NIC. */
  paye: boolean;
  /** Employer's PAYE scheme. */
  employerPaye: boolean;
  /** VAT. */
  vat: boolean;
  /** Construction Industry Scheme. */
  cis: boolean;
  /** Tax credits. */
  taxCredits: boolean;
  /** VAT DIY housebuilder scheme. */
  vatDiy: boolean;
}

export const FORM_648_TAX_LABELS: Array<{ key: keyof Form648Taxes; label: string; hint?: string }> = [
  { key: "corpTax", label: "Corporation Tax", hint: "Limited companies" },
  { key: "sa", label: "Self Assessment", hint: "Individual tax returns" },
  { key: "partnership", label: "Partnership", hint: "Partnership tax returns" },
  { key: "vat", label: "VAT" },
  { key: "employerPaye", label: "Employer's PAYE scheme", hint: "If we run your payroll" },
  { key: "paye", label: "Individual PAYE and National Insurance" },
  { key: "cis", label: "Construction Industry Scheme (CIS)" },
  { key: "trust", label: "Trust" },
  { key: "taxCredits", label: "Tax credits" },
  { key: "vatDiy", label: "VAT DIY housebuilder scheme" },
];

export const EMPTY_648_TAXES: Form648Taxes = {
  sa: false,
  partnership: false,
  trust: false,
  corpTax: false,
  paye: false,
  employerPaye: false,
  vat: false,
  cis: false,
  taxCredits: false,
  vatDiy: false,
};

export interface Form648Input {
  firm: FirmConfig;
  /** The signing individual — HMRC's "Your name". */
  clientName: string;
  /** Company / business name, where the client is not an individual. */
  companyName?: string | null;
  /** Client's address; registered office for a company. */
  address?: string | null;
  postcode?: string | null;
  phone?: string | null;
  /** Unique Taxpayer Reference, 10 digits. Blank if we do not hold it. */
  utr?: string | null;
  /** Company registration number. */
  companyNumber?: string | null;
  taxes: Form648Taxes;
  /** Typed legal name of the signatory. Absent = unsigned copy. */
  signedName?: string | null;
  /** PNG/JPEG data URL when the client drew or uploaded their signature. */
  signedImage?: string | null;
  /** ISO timestamp of the engagement signature; fills the form's date box. */
  signedAt?: string | null;
  /** Audit reference from the engagement signing, printed as the provenance note. */
  auditRef?: string | null;
  /**
   * Staff preview, before any client has signed. Banded on every page: it can
   * carry a signature the client has not given, so it must never be capable of
   * being mistaken for a real authorisation sent to HMRC.
   */
  specimen?: boolean;
  /**
   * Leave the form fields editable instead of flattening.
   *
   * Only for tests, which assert the field mapping by reading values back.
   * Never use it for a document that goes to a client or to HMRC: an unflattened
   * form can be edited after signing.
   */
  keepEditable?: boolean;
}

const GREY = rgb(0.42, 0.45, 0.5);
const INK = rgb(0.1, 0.24, 0.63);

/**
 * Geometry of the signature and date boxes on page 1.
 *
 * HMRC left these two boxes out of the AcroForm, so there are no field
 * rectangles to fill and the coordinates have to be stated here. They are
 * derived from the form's own field anchors, which ARE in the AcroForm and so
 * are exact: the client phone-number box sits at y=295 and the agent address
 * box at y=158, and the declaration block falls between them.
 */
/*
 * Derived from the left column's row rhythm, which the AcroForm fixes exactly:
 * every box there is 16pt tall on a 17pt pitch (client address boxes run
 * 363/346/329/312/295, agent boxes 158/141/124/107/90). The declaration block
 * sits between the client phone box (bottom 295) and the agent heading above
 * the agent address box (bottom 158), so its own rows fall out of that pitch:
 * three lines of declaration text, a tall Signature row, then a Date row of
 * normal height. A value's baseline sits ~4pt above its row's floor.
 */
const SIG = { x: 46, y: 216, maxW: 230, maxH: 26 };
const DATE = { x: 78, y: 199 };
/** Right column below the shaded panel (which ends at y=128) is clear. */
const NOTE = { x: 306, y: 112, width: 250 };

/** The template is WinAnsi-encoded; anything outside Latin-1 cannot be drawn. */
function sanitize(v: string | null | undefined): string {
  return (v ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "").trim();
}

/** HMRC asks for capitals on the hand-completed boxes. */
function caps(v: string | null | undefined): string {
  return sanitize(v).toUpperCase();
}

/** Split a free-text address into the form's three address lines. */
function addressLines(address: string | null | undefined, postcode?: string | null): string[] {
  const parts = sanitize(address)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // The form has a separate postcode box, so drop a trailing postcode.
  const pc = sanitize(postcode).toUpperCase();
  while (parts.length && pc && parts[parts.length - 1]!.toUpperCase() === pc) parts.pop();
  if (parts.length <= 3) return parts;
  // Too many lines: keep the first two and fold the remainder into the third,
  // rather than silently dropping part of the address.
  return [parts[0]!, parts[1]!, parts.slice(2).join(", ")];
}

/** UTRs print as two five-digit halves. Anything that isn't 10 digits is left blank. */
function splitUtr(utr: string | null | undefined): [string, string] {
  const digits = sanitize(utr).replace(/\D/g, "");
  if (digits.length !== 10) return ["", ""];
  return [digits.slice(0, 5), digits.slice(5)];
}

export function formatSignedDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Whether an engagement includes a 64-8, decided from its stored letterMeta.
 *
 * A MISSING flag means NO — deliberately the opposite of how the other optional
 * sections behave (`includeAnnexA !== false` treats missing as yes).
 *
 * Engagement PDFs are not stored. Every request rebuilds the letter from
 * letterMeta, the signed copy included. So if a missing flag meant "include",
 * then the moment this feature shipped, every engagement already sent — and
 * every one already SIGNED — would start producing a contract with a 64-8
 * appended to it that the client never saw and never authorised. The signed PDF
 * is the record of what was agreed; it must keep saying what it said on the day
 * it was signed.
 *
 * "On by default" is a property of the wizard, which writes an explicit `true`
 * for new engagements. It is not a property of reading old records.
 */
export function is648Enabled(letterMeta: Record<string, unknown> | null | undefined): boolean {
  return (letterMeta ?? {}).include648 === true;
}

/** True when this firm can issue a 64-8 at all (i.e. we hold its agent codes). */
export function firmCanIssue648(firm: FirmConfig): boolean {
  return Boolean(firm.agent648);
}

async function embedSignature(pdf: PDFDocument, dataUri: string) {
  const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(dataUri ?? "");
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[2]!, "base64");
    return m[1]!.toLowerCase() === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null; // a bad asset must not block the authorisation
  }
}

/**
 * Builds the completed 64-8 as its own document.
 *
 * Returns a PDFDocument so the engagement letter can copy the pages straight in;
 * use `buildForm648Bytes` when a standalone file is wanted.
 */
export async function buildForm648Doc(input: Form648Input): Promise<PDFDocument> {
  const pdf = await PDFDocument.load(Buffer.from(FORM_648_TEMPLATE_BASE64, "base64"));
  const form = pdf.getForm();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const agent = input.firm.agent648;

  /* Anything that stops a value reaching the form is recorded and reported.
     Several boxes are length-capped by HMRC (the company-number box takes 8
     characters, VAT 9, each UTR half 5) and pdf-lib THROWS on an over-long
     value. Swallowing that would post an authorisation with a silently missing
     company number, so over-long values are trimmed to fit and logged, and an
     unknown field name — which can only mean the template and this code have
     diverged — is surfaced rather than skipped. */
  const problems: string[] = [];

  const set = (name: string, value: string) => {
    let field;
    try {
      field = form.getTextField(name);
    } catch {
      problems.push(`unknown field "${name}"`);
      return;
    }
    const max = field.getMaxLength();
    let v = value;
    if (typeof max === "number" && max > 0 && v.length > max) {
      problems.push(`"${name}" trimmed from ${v.length} to ${max} characters`);
      v = v.slice(0, max);
    }
    field.setText(v);
  };

  const tick = (name: string, on: boolean) => {
    try {
      const box = form.getCheckBox(name);
      if (on) box.check();
      else box.uncheck();
    } catch {
      problems.push(`unknown checkbox "${name}"`);
    }
  };

  // --- Client side. Capitals, as the form asks.
  set("txtName", caps(input.clientName));
  set("txtCompanyName", caps(input.companyName));
  const lines = addressLines(input.address, input.postcode);
  set("YourAddress1", caps(lines[0] ?? ""));
  set("YourAddress2", caps(lines[1] ?? ""));
  set("YourAddress3", caps(lines[2] ?? ""));
  set("YourPost code", caps(input.postcode));
  set("YourPhoneNumber", sanitize(input.phone));
  set("CRN", caps(input.companyNumber));

  // The same UTR belongs in whichever regime it was issued under.
  const [u1, u2] = splitUtr(input.utr);
  if (input.taxes.sa || input.taxes.partnership) {
    set("UTR 1-5", u1);
    set("UTR 6-10", u2);
  }
  if (input.taxes.corpTax) {
    set("CT UTR 1-5", u1);
    set("CT UTR 6-10", u2);
  }

  // --- Agent side, always written explicitly.
  //
  // Every agent field is set even when we hold no codes, so that a firm without
  // an `agent648` block cannot inherit whatever the template happened to carry.
  set("AgentName", sanitize(input.firm.legalName));
  const firmAddr = addressLines(input.firm.address);
  set("AgentsAddress1", sanitize(firmAddr[0] ?? ""));
  set("AgentsAddress2", sanitize(firmAddr[1] ?? ""));
  set("AgentsAddress3", sanitize(input.firm.city));
  set("AgentsPostCode", sanitize(input.firm.postcode));
  set("AgentsPhoneNumber", sanitize(input.firm.phone));
  set("Agent code SA", sanitize(agent?.saCode));
  set("Agent code CT", sanitize(agent?.ctCode));
  // GNS's own submitted forms fill the CIS pair and leave the employer pair
  // blank; mirrored here so what we send matches what HMRC already accepts.
  set("CIS Agent Gateway ID", sanitize(agent?.gatewayId));
  set("CIS PAYE ID", sanitize(agent?.payeAgentId));

  // --- Tax heads.
  tick("chkSA", input.taxes.sa);
  tick("chkPartnership", input.taxes.partnership);
  tick("chkTrust", input.taxes.trust);
  tick("chkCorpTax", input.taxes.corpTax);
  tick("chkPAYE", input.taxes.paye);
  tick("chkEmp PAYE scheme", input.taxes.employerPaye);
  tick("chkVAT", input.taxes.vat);
  tick("chkCIS", input.taxes.cis);
  tick("chkTaxcredits", input.taxes.taxCredits);
  tick("chkVATDIY", input.taxes.vatDiy);

  /* Deliberately console rather than the app logger: the other PDF builders
     import nothing, and the logger's contract is that PII never reaches it —
     so the firm and the problem are reported, never the client's details. */
  if (problems.length) {
    console.warn(`form 64-8 (${input.firm.slug}): values did not map cleanly onto the form:`, problems.join("; "));
  }

  // Bake the values in. After this the form is a flat document: nothing on it
  // can be re-edited, and the "Clear form" button is already gone from the
  // template, so a completed authorisation cannot be silently altered.
  form.updateFieldAppearances(helv);
  if (!input.keepEditable) form.flatten();

  const page1 = pdf.getPages()[0]!;

  // --- Signature and date.
  if (input.signedName || input.signedImage) {
    const drawn = input.signedImage ? await embedSignature(pdf, input.signedImage) : null;
    if (drawn) {
      const scale = Math.min(SIG.maxW / drawn.width, SIG.maxH / drawn.height, 1);
      page1.drawImage(drawn, {
        x: SIG.x,
        y: SIG.y,
        width: drawn.width * scale,
        height: drawn.height * scale,
      });
    } else if (input.signedName) {
      // Matches the contract: the same name, drawn the same way.
      page1.drawText(sanitize(input.signedName), {
        x: SIG.x,
        y: SIG.y,
        size: 20,
        font: helvBold,
        color: INK,
      });
    }
    const dateStr = formatSignedDate(input.signedAt);
    if (dateStr) {
      page1.drawText(dateStr, { x: DATE.x, y: DATE.y, size: 10, font: helv, color: INK });
    }
  }

  // --- Provenance note.
  //
  // The client signed the engagement letter, not this sheet, so the form says
  // so. Anyone reading it later — HMRC, a reviewer, the client — can see where
  // the signature came from instead of having to assume it was signed here.
  const note = input.specimen
    ? ["SPECIMEN - not a valid authorisation.", "Preview only; no signature has been given."]
    : input.signedName
      ? [
          `Signed electronically on ${formatSignedDate(input.signedAt) || "the date shown"} by`,
          `${sanitize(input.signedName)}, as part of the signed engagement letter`,
          `with ${sanitize(input.firm.legalName)}.`,
          ...(input.auditRef ? [`Audit reference: ${sanitize(input.auditRef)}`] : []),
        ]
      : [];
  note.forEach((line, i) => {
    page1.drawText(line, {
      x: NOTE.x,
      y: NOTE.y - i * 9,
      size: 6.5,
      font: helv,
      color: input.specimen ? rgb(0.7, 0.1, 0.1) : GREY,
      maxWidth: NOTE.width,
    });
  });

  // --- Specimen banding on every page.
  if (input.specimen) {
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      const label = "SPECIMEN - NOT FOR SUBMISSION";
      const size = 20;
      page.drawRectangle({
        x: 0,
        y: height / 2 - 16,
        width,
        height: 32,
        color: rgb(1, 1, 1),
        opacity: 0.72,
      });
      page.drawText(label, {
        x: (width - helvBold.widthOfTextAtSize(label, size)) / 2,
        y: height / 2 - 6,
        size,
        font: helvBold,
        color: rgb(0.8, 0.15, 0.15),
        opacity: 0.85,
      });
    }
  }

  return pdf;
}

/** The completed 64-8 as a standalone file. */
export async function buildForm648Bytes(input: Form648Input): Promise<Buffer> {
  const pdf = await buildForm648Doc(input);
  return Buffer.from(await pdf.save());
}

/** Copies the completed 64-8 onto the end of an already-built document. */
export async function appendForm648(target: PDFDocument, input: Form648Input): Promise<void> {
  const src = await buildForm648Doc(input);
  const pages = await target.copyPages(src, src.getPageIndices());
  pages.forEach((p) => target.addPage(p));
}
