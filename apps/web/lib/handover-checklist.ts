/**
 * THE HANDOVER CHECKLIST.
 *
 * What has to be collected when a client moves to us, who it has to come from,
 * and — the part that was costing a partner's day — WHICH PERIOD each record
 * has to cover. The periods are worked out from the client's own dates rather
 * than asked for, because "get the P11D" is the question a staff member can
 * already answer; "the P11D to 30 September 2026, because payroll runs in
 * October" is the one they have to interrupt someone for.
 *
 * Every item carries three things beyond its name:
 *
 *   source   — who physically has it: the previous accountant, the client,
 *              HMRC, or us. This is what decides who gets chased.
 *   applies  — whether it is relevant at all. A client with no PAYE scheme
 *              should see "not applicable", not an open item nobody closes.
 *   period   — the dates it must cover, where that is computable.
 *
 * Nothing here writes to the database. It is the list and the arithmetic, kept
 * apart so both can be read and argued with by an accountant rather than a
 * programmer.
 */

export type ChecklistStatus = "pending" | "received" | "verified" | "na";

/** Who actually holds the thing. This decides who gets chased, and by whom. */
export type ItemSource = "previous_accountant" | "client" | "hmrc" | "us";

export interface ClientFacts {
  /** When the client comes to us. Drives every "up to" date. */
  onboardingDate: Date;
  /** Registered for VAT? Unknown is NOT the same as no — see vatRegistered. */
  vatRegistered: boolean | null;
  /** Operates a PAYE scheme? */
  payeRegistered: boolean | null;
  /** Has the company filed accounts at Companies House before? */
  hasFilingHistory: boolean | null;
  /** The date the last accounts were made up to, if any (e.g. 31 Oct 2025). */
  lastAccountsTo?: Date | null;
  /** The period end of the last VAT return the previous accountant filed. */
  lastVatReturnTo?: Date | null;
  /** Books kept on Sage/Xero/QuickBooks etc., so a migration backup exists. */
  previousSoftware?: string | null;
}

export interface ChecklistItem {
  key: string;
  label: string;
  category: "client" | "accounts" | "vat" | "bookkeeping" | "payroll" | "prior_year";
  source: ItemSource;
  /** False when this client does not need it — shown as "not applicable". */
  applies: boolean;
  /** Why it does not apply, so nobody reopens it to ask. */
  naReason?: string;
  /** The period this record must cover, where that can be worked out. */
  period?: { from?: Date; to: Date; why: string };
  /** Said plainly, for the person doing the chasing. */
  hint?: string;
}

// ── Dates ────────────────────────────────────────────────────────────────

/** The last day of the month before the given date. */
export function previousMonthEnd(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
}

/** The day after a period end — where the next records must start. */
export function dayAfter(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}

export function formatUk(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * PAYROLL RECORDS MUST JOIN UP WITH THE LAST ACCOUNTS.
 *
 * If the accounts were made up to 31 October 2025 and the client arrives in
 * October 2026, we need every payroll month from 1 November 2025 to the end of
 * last month — pension and student loan included — or the first payroll we run
 * has no opening position. Without a last-accounts date there is no sensible
 * start, so only the end is stated and the staff member is told why.
 */
export function payrollPeriod(facts: ClientFacts): { from?: Date; to: Date; why: string } {
  const to = previousMonthEnd(facts.onboardingDate);
  if (facts.lastAccountsTo) {
    const from = dayAfter(facts.lastAccountsTo);
    return {
      from,
      to,
      why: `from the day after the last filed accounts (${formatUk(facts.lastAccountsTo)}) to the end of last month, so the first payroll we run has an opening position`,
    };
  }
  return {
    to,
    why: "to the end of last month. Ask the previous accountant what date their records start from — without the last accounts date we cannot work out the beginning",
  };
}

/**
 * P11D UP TO THE END OF LAST MONTH.
 *
 * A client arriving on 27 October 2026 needs the P11D position to 30 September
 * 2026, so that October's payroll can be run with the benefits already in it.
 */
export function p11dPeriod(facts: ClientFacts): { to: Date; why: string } {
  const to = previousMonthEnd(facts.onboardingDate);
  return {
    to,
    why: `so the ${facts.onboardingDate.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })} payroll can be run with benefits already accounted for`,
  };
}

/**
 * BOOKKEEPING RECORDS UP TO THE LAST VAT RETURN FILED.
 *
 * For a VAT-registered client the natural handover line is the last return the
 * previous accountant filed: we pick up from the day after. An annual client
 * with no VAT has no such line, and the item is marked not applicable rather
 * than left open for someone to wonder about.
 */
export function bookkeepingPeriod(facts: ClientFacts): { to: Date; why: string } | null {
  if (!facts.vatRegistered) return null;
  if (facts.lastVatReturnTo) {
    return {
      to: facts.lastVatReturnTo,
      why: "up to the last VAT return they filed — we carry on from the day after",
    };
  }
  return {
    to: previousMonthEnd(facts.onboardingDate),
    why: "up to the last VAT return filed. Confirm that period with the previous accountant — we do not yet hold it",
  };
}

// ── The list ─────────────────────────────────────────────────────────────

/**
 * Build the checklist for one client.
 *
 * Items that do not apply are KEPT, marked not applicable with the reason.
 * Removing them would leave a staff member wondering whether the question was
 * asked and dismissed, or never asked at all.
 */
export function buildChecklist(facts: ClientFacts): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const vat = facts.vatRegistered === true;
  const paye = facts.payeRegistered === true;
  const vatUnknown = facts.vatRegistered === null || facts.vatRegistered === undefined;

  const add = (i: ChecklistItem) => items.push(i);

  // ── Client: who they are ──────────────────────────────────────────────
  add({ key: "client_id", label: "Client ID (passport or driving licence)", category: "client", source: "client", applies: true });
  add({ key: "client_address", label: "Client address document", category: "client", source: "client", applies: true });
  add({ key: "aml", label: "AML verification", category: "client", source: "us", applies: true });
  add({ key: "cdd", label: "Client due diligence (CDD)", category: "client", source: "us", applies: true });

  // ── Accounts and gateway ──────────────────────────────────────────────
  add({ key: "ch_auth_code", label: "Companies House authentication code", category: "accounts", source: "client", applies: true,
        hint: "The client receives this by post from Companies House; the previous accountant may hold it." });
  add({ key: "company_utr", label: "Company UTR number", category: "accounts", source: "client", applies: true });
  add({ key: "paye_ref", label: "PAYE reference number", category: "accounts", source: "previous_accountant", applies: paye,
        naReason: paye ? undefined : "no PAYE scheme" });
  add({ key: "paye_accounts_office_ref", label: "PAYE Accounts Office reference", category: "accounts", source: "previous_accountant", applies: paye,
        naReason: paye ? undefined : "no PAYE scheme" });

  // ── VAT ───────────────────────────────────────────────────────────────
  /* THE QUESTION THAT CAUSED THE TROUBLE LAST TIME.
     On the last onboarding the previous accountant said they had never created
     a VAT login, the client said they did not have one either, and HMRC would
     not let us add the VAT service to the new gateway. Nobody had established,
     at the start, whether the client was VAT registered at all. It is now the
     first item, and it blocks the rest of this section. */
  add({ key: "vat_registered_confirmed", label: "Confirm whether the client is registered for VAT", category: "vat", source: "client", applies: true,
        hint: vatUnknown
          ? "Not yet established. Settle this before chasing anything else in this section — an unanswered VAT registration is what caused the gateway problem last time."
          : vat ? "Confirmed registered." : "Confirmed NOT registered." });
  add({ key: "vat_number", label: "VAT registration number", category: "vat", source: "client", applies: vat, naReason: vat ? undefined : "not VAT registered" });
  add({ key: "vat_certificate", label: "VAT certificate (showing the effective date of registration)", category: "vat", source: "client", applies: vat, naReason: vat ? undefined : "not VAT registered" });
  add({ key: "vat_last_filed", label: "Last VAT return filed (period and figures)", category: "vat", source: "previous_accountant", applies: vat, naReason: vat ? undefined : "not VAT registered" });
  add({ key: "vat_login", label: "VAT login ID (government gateway)", category: "vat", source: "client", applies: vat, naReason: vat ? undefined : "not VAT registered",
        hint: "If nobody has ever created one, say so here — that is an answer, and it stops the same search happening twice." });
  add({ key: "vat_gateway_auth", label: "VAT gateway authorisation receipt", category: "vat", source: "hmrc", applies: vat, naReason: vat ? undefined : "not VAT registered" });

  // ── Bookkeeping ───────────────────────────────────────────────────────
  const bk = bookkeepingPeriod(facts);
  add({ key: "bookkeeping_records", label: "Bookkeeping records up to the last VAT return filed", category: "bookkeeping",
        source: "previous_accountant", applies: Boolean(bk), naReason: bk ? undefined : "annual client, not VAT registered",
        period: bk ? { to: bk.to, why: bk.why } : undefined });
  add({ key: "software_backup", label: `Software migration backup${facts.previousSoftware ? ` (${facts.previousSoftware})` : " (Sage, Xero, QuickBooks…)"}`,
        category: "bookkeeping", source: "previous_accountant", applies: true,
        hint: "If they keep no software records, mark not applicable and note what they do keep." });

  // ── Payroll ───────────────────────────────────────────────────────────
  const pay = payrollPeriod(facts);
  const p11d = p11dPeriod(facts);
  const naPayroll = paye ? undefined : "no PAYE scheme";
  add({ key: "employee_details", label: "Employee details (name, address, NI number, tax code)", category: "payroll", source: "previous_accountant", applies: paye, naReason: naPayroll });
  add({ key: "employee_records", label: "Employee payroll records", category: "payroll", source: "previous_accountant", applies: paye, naReason: naPayroll,
        period: paye ? pay : undefined });
  add({ key: "p11d", label: "P11D / benefits position", category: "payroll", source: "previous_accountant", applies: paye, naReason: naPayroll,
        period: paye ? p11d : undefined });
  add({ key: "pension_deductions", label: "Pension deductions", category: "payroll", source: "previous_accountant", applies: paye, naReason: naPayroll,
        period: paye ? pay : undefined });
  add({ key: "student_loan", label: "Student loan deductions", category: "payroll", source: "previous_accountant", applies: paye, naReason: naPayroll,
        period: paye ? pay : undefined });
  add({ key: "pension_portal_access", label: "Pension portal access (NEST or other provider)", category: "payroll", source: "client", applies: paye, naReason: naPayroll,
        hint: "Access has been the slow part before. Start it early and note which provider." });

  // ── Prior year ────────────────────────────────────────────────────────
  /* NOT the filed accounts — Companies House has those. What it does NOT show
     is the detailed profit and loss or the tax computation, and those are what
     the next return is built on. A company incorporated within the last year
     has nothing filed, so this is not applicable rather than outstanding. */
  const filed = facts.hasFilingHistory === true;
  add({ key: "ct600_last_year", label: "CT600 and tax computation for the last filed year", category: "prior_year",
        source: "previous_accountant", applies: filed,
        naReason: filed ? undefined : "newly incorporated — nothing filed at Companies House yet",
        hint: "Companies House shows the filed accounts but not the detailed P&L or the computation; ask for those, not the accounts." });
  add({ key: "detailed_pl", label: "Detailed profit and loss for the last filed year", category: "prior_year",
        source: "previous_accountant", applies: filed,
        naReason: filed ? undefined : "newly incorporated — nothing filed at Companies House yet" });

  return items;
}

/** The categories in the order a handover is actually worked through. */
export const CATEGORY_LABELS: Record<ChecklistItem["category"], string> = {
  client: "Client identity and compliance",
  accounts: "Accounts and gateway",
  vat: "VAT",
  bookkeeping: "Bookkeeping records",
  payroll: "Payroll",
  prior_year: "Prior year",
};

export const SOURCE_LABELS: Record<ItemSource, string> = {
  previous_accountant: "Previous accountant",
  client: "Client",
  hmrc: "HMRC",
  us: "Us",
};
