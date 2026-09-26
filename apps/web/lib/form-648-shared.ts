/**
 * Form 64-8 types and rules, with no PDF machinery attached.
 *
 * Split out from form-648-pdf.ts on purpose: that module embeds the ~1.5MB
 * base64 form template, and the wizard and signing page are client components.
 * Importing the renderer there would ship the whole template to every browser.
 * Everything here is plain data and pure functions, safe on both sides.
 */

import { FIRMS } from "./firms";

/**
 * Firms that can issue a 64-8, i.e. whose HMRC agent codes we hold.
 *
 * A 64-8 without them authorises nothing, so the option is hidden rather than
 * offered and quietly produced blank — the client would have to sign again.
 */
export const FIRMS_WITH_648: ReadonlySet<string> = new Set(
  Object.values(FIRMS)
    .filter((f) => f.agent648)
    .map((f) => f.slug),
);

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
  { key: "partnership", label: "Partnership", hint: "Partnership and LLP returns" },
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

/** Human-readable list of the ticked heads, for the client's coverage summary. */
export function list648Taxes(taxes: Form648Taxes): string[] {
  return FORM_648_TAX_LABELS.filter((t) => taxes[t.key]).map((t) => t.label);
}

/**
 * The tick set an engagement starts with, derived from what is actually being
 * sold and to whom.
 *
 * A starting point, not a decision: staff review it in the wizard and the
 * client can untick anything before signing. It errs towards the regimes the
 * engagement plainly covers rather than ticking everything, because each tick
 * is a separate authorisation over the client's tax affairs.
 */
export function default648Taxes(args: {
  clientType?: string | null;
  services?: readonly string[] | null;
}): Form648Taxes {
  const svc = new Set((args.services ?? []).map((s) => String(s)));
  const type = (args.clientType ?? "limited").toLowerCase();
  return {
    ...EMPTY_648_TAXES,
    corpTax: type === "limited",
    // Partnerships and LLPs file partnership returns; everyone else who is not
    // a company is self-assessed.
    partnership: type === "partnership" || type === "llp",
    sa: svc.has("self_assessment") || type === "sole_trader" || type === "individual" || type === "btl",
    vat: svc.has("bookkeeping_vat"),
    employerPaye: svc.has("paye"),
    cis: svc.has("cis"),
  };
}

/** What the client actually agreed to, written into acceptanceData at signing. */
export interface Form648Snapshot {
  included: boolean;
  taxes: Form648Taxes;
}

/** Reads a tick set out of stored JSON, defaulting anything absent to unticked. */
export function read648Taxes(value: unknown): Form648Taxes {
  const src = (value ?? {}) as Record<string, unknown>;
  const out = { ...EMPTY_648_TAXES };
  for (const key of Object.keys(out) as Array<keyof Form648Taxes>) {
    out[key] = src[key] === true;
  }
  return out;
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

/**
 * Decides what 64-8, if any, belongs on a given rendering of an engagement.
 *
 * Engagement PDFs are rebuilt on every request rather than stored, so "what
 * goes in this document" is recomputed each time. For an unsigned letter that
 * is what we want. For a SIGNED one it is dangerous, because it means today's
 * settings decide what yesterday's signed contract says.
 *
 * So a signed engagement renders from the snapshot taken when the client
 * signed, and nothing staff change afterwards can alter it. A signed
 * engagement carrying no snapshot was signed before this feature existed and
 * gets no 64-8 — it cannot acquire one retrospectively.
 *
 * For UNSIGNED engagements this reads current settings, but that is a weaker
 * guarantee than the 64-8 actually has: whether an engagement includes one is
 * fixed when the link is created and the PATCH route refuses to change it, so
 * an engagement already sitting in a client's inbox cannot have the 64-8
 * switched on or off underneath them. This is the second line of defence.
 */
export function resolve648(args: {
  letterMeta?: Record<string, unknown> | null;
  acceptanceData?: Record<string, unknown> | null;
  /** True when rendering the signed copy of an accepted engagement. */
  signed: boolean;
}): Form648Snapshot {
  if (args.signed) {
    const snap = (args.acceptanceData ?? {}).form648 as Record<string, unknown> | undefined;
    if (!snap || snap.included !== true) return { included: false, taxes: { ...EMPTY_648_TAXES } };
    return { included: true, taxes: read648Taxes(snap.taxes) };
  }
  const lm = args.letterMeta ?? {};
  if (lm.include648 !== true) return { included: false, taxes: { ...EMPTY_648_TAXES } };
  return { included: true, taxes: read648Taxes(lm.taxes648) };
}
