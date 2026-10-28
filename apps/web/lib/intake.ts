/**
 * The partner intake form — the one place a new client is written down.
 *
 * It replaces the "New Client Handover — Partner → Sagar" spreadsheet that was
 * filled in on SharePoint and then re-typed into the engagement wizard, the
 * clearance request and the handover checklist. Typing the same client in four
 * places is not just slow: the four copies disagree, and the one a letter is
 * built from is whichever was typed last.
 *
 * So this is the form, and everything downstream reads from it. What the
 * partner sold, what it costs, who to talk to, who held the books before, and
 * what nobody should discover halfway through.
 */

export type FilledByRole = "partner" | "staff";
export type ContactMethod = "email" | "phone" | "whatsapp" | "post";
export type FeeBasis = "monthly_dd" | "monthly_invoice" | "one_off" | "other";

export interface IntakeContact {
  name: string;
  email: string;
  mobile: string;
  preferred: ContactMethod;
}

export interface IntakePreviousAccountant {
  firmName: string;
  address: string;
  email: string;
  phone: string;
}

export interface IntakeForm {
  /** Who filled this in, and under which name. Partners sell; staff often
   *  write it up afterwards, and the two carry different authority when a fee
   *  is later disputed. */
  filledByRole: FilledByRole;
  filledByName: string;

  clientName: string;
  /** Blank for sole traders, partnerships and individuals. */
  companyNumber: string;
  /** The partner who sold the work, which is not always who typed the form. */
  partnerName: string;
  firmSlug: string;

  /** 1. What was sold, in the partner's own shorthand — "AA/CT-£1.5M, VAT,
   *  PAYE-12, CIS-15, SA-2". Kept verbatim because it is evidence of what was
   *  agreed; the priced services are chosen separately in the wizard. */
  servicesSold: string;

  /** 2. The fee and how it is paid. */
  feeAmount: string;
  feeBasis: FeeBasis;
  feeNote: string;

  /** 3. Who we actually speak to. */
  contact: IntakeContact;

  /** 4. Work already behind — the thing that most often turns a clean
   *  onboarding into a three-month one, and is most often not written down. */
  catchupWork: string;
  catchupFee: string;

  /** 5. Who held the books before, so clearance can go out without chasing
   *  the partner for an address a week later. */
  previousAccountant: IntakePreviousAccountant;

  /** 6. Anything the next person must not find out the hard way. */
  sensitiveNotes: string;
}

export const EMPTY_INTAKE: IntakeForm = {
  filledByRole: "partner",
  filledByName: "",
  clientName: "",
  companyNumber: "",
  partnerName: "",
  firmSlug: "gns",
  servicesSold: "",
  feeAmount: "",
  feeBasis: "monthly_dd",
  feeNote: "",
  contact: { name: "", email: "", mobile: "", preferred: "email" },
  catchupWork: "",
  catchupFee: "",
  previousAccountant: { firmName: "", address: "", email: "", phone: "" },
  sensitiveNotes: "",
};

export const FEE_BASIS_LABELS: Record<FeeBasis, string> = {
  monthly_dd: "Monthly by Direct Debit",
  monthly_invoice: "Monthly, invoiced",
  one_off: "One-off fee",
  other: "Other / to be agreed",
};

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  email: "Email",
  phone: "Phone",
  whatsapp: "WhatsApp",
  post: "Post",
};

/**
 * What stops this being sendable.
 *
 * Deliberately short. Only three things are needed to put an engagement letter
 * in front of a client, and demanding more here would push people back to the
 * spreadsheet — which is the thing this exists to replace.
 */
export function intakeBlockers(f: IntakeForm): string[] {
  const out: string[] = [];
  if (!f.clientName.trim()) out.push("the client's name");
  if (!f.contact.email.trim()) out.push("an email address to send it to");
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contact.email.trim())) out.push("a valid email address");
  if (!f.partnerName.trim() && !f.filledByName.trim()) out.push("who sold the work");
  return out;
}

/**
 * Things worth saying out loud before sending, that are not reasons to stop.
 *
 * A warning that blocks gets worked around; one that informs gets read. These
 * are the omissions that cost a week later on, so they are said at the moment
 * the person can still fix them cheaply.
 */
export function intakeWarnings(f: IntakeForm): string[] {
  const out: string[] = [];
  if (!f.servicesSold.trim()) out.push("No services recorded — the letter will have nothing priced in it.");
  if (!f.feeAmount.trim()) out.push("No fee recorded.");
  if (!f.previousAccountant.firmName.trim()) {
    out.push("No previous accountant — clearance cannot go out until that is known.");
  } else if (!f.previousAccountant.email.trim()) {
    out.push("The previous accountant has no email, so clearance cannot be sent to them yet.");
  }
  if (f.catchupWork.trim() && !f.catchupFee.trim()) {
    out.push("Catch-up work is recorded with no fee against it.");
  }
  return out;
}

/**
 * The intake, as the WIZARD reads a saved draft.
 *
 * The wizard resumes from `letterMeta.wizardDraft`, not from the intake blob,
 * so writing only the intake left "Price it in the wizard" opening with the
 * partner, the fee basis, the catch-up charge and the clearance choice all
 * blank — the exact retyping this form exists to remove. Both are written, and
 * this is the half the wizard looks at.
 */
export function intakeToWizardDraft(f: IntakeForm): Record<string, unknown> {
  const catchupFee = Number(String(f.catchupFee).replace(/[^0-9.]/g, "")) || 0;
  const hasPrevFirm = Boolean(f.previousAccountant.firmName.trim());
  return {
    step: "services",
    firmSlug: f.firmSlug,
    companyNumber: f.companyNumber.trim(),
    companyName: f.clientName.trim(),
    clientName: f.clientName.trim(),
    directorName: f.contact.name.trim(),
    directorEmail: f.contact.email.trim(),
    partnerName: f.partnerName.trim() || f.filledByName.trim() || null,
    paymentMethod: f.feeBasis === "monthly_dd" ? "dd" : "manual",
    customFees: catchupFee
      ? [{
          title: "Catch-up work",
          description: f.catchupWork.trim() || "Bringing the records up to date before our engagement begins.",
          price: catchupFee,
          frequency: "one-off",
        }]
      : [],
    includeClearance: hasPrevFirm,
    // "client" asks them to confirm the outgoing firm at signing; with nobody
    // to ask there is nothing to run, which is what "none" means here.
    clearanceMode: hasPrevFirm ? "client" : "none",
    prevFirmName: f.previousAccountant.firmName.trim(),
    prevFirmEmail: f.previousAccountant.email.trim(),
    specialTerms: f.sensitiveNotes.trim(),
    savedAt: new Date().toISOString(),
  };
}

/**
 * The intake, as the engagement-letter route wants it.
 *
 * Only the fields that route actually reads. The rest of the intake is stored
 * alongside, so the clearance request and the handover checklist can take what
 * they need without anyone retyping it.
 */
export function intakeToCreatePayload(f: IntakeForm): Record<string, unknown> {
  const catchupFee = Number(String(f.catchupFee).replace(/[^0-9.]/g, "")) || 0;
  return {
    firmSlug: f.firmSlug,
    companyName: f.clientName.trim(),
    companyNumber: f.companyNumber.trim() || undefined,
    clientName: f.clientName.trim(),
    directorName: f.contact.name.trim() || undefined,
    directorEmail: f.contact.email.trim(),
    partnerName: f.partnerName.trim() || f.filledByName.trim() || undefined,
    // Direct Debit is the default the practice sells on; anything else is
    // invoiced, which is what "manual" means to the letter.
    paymentMethod: f.feeBasis === "monthly_dd" ? "dd" : "manual",
    // Catch-up is a one-off charge, not part of the monthly fee, and saying so
    // in the letter is what stops the argument about what the £500 covered.
    customFees: catchupFee
      ? [{
          title: "Catch-up work",
          description: f.catchupWork.trim() || "Bringing the records up to date before our engagement begins.",
          price: catchupFee,
          frequency: "one-off",
        }]
      : [],
    // Clearance is wanted whenever there is someone to ask.
    includeClearance: Boolean(f.previousAccountant.firmName.trim()),
    prevFirmName: f.previousAccountant.firmName.trim() || undefined,
    prevFirmEmail: f.previousAccountant.email.trim() || undefined,
    specialTerms: f.sensitiveNotes.trim() || undefined,
  };
}
