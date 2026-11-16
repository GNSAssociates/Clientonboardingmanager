/**
 * The GNS website's Instant Fee Quote prices, as code the platform can check
 * a quote against.
 *
 * Source of truth: the calculator on https://www.gnsassociates.co.uk/instant-fee-quote/,
 * which is two scripts: the base calculator (window.gnsQuoteCalc, in the
 * "Instant Quote" snippet) and the overlay "Quote page – single turnover
 * control + tidy email summary" (Custom CSS & JS #20452), which replaces the
 * accounts fee curve, the VAT tiers and the bank-account charges, and adds the
 * sole trader and BTL landlord rules. Read on 16 Nov 2026. If the website's
 * prices change, change them here too, or every quote will be flagged.
 *
 * checkQuote() reads a quote as the website emailed it (either summary format
 * the site has used) and re-prices each line it can, so staff see at a glance
 * whether the figure the visitor saw is still right before replying.
 *
 * Pure: no network, no database. Tested by scripts/test-quote-rules.mts.
 */

const round = Math.round;

/** Straight-line between the price points, as the website does. */
function interpolate(points: Array<[number, number]>, x: number): number {
  let v = points[0]![1];
  for (let k = 0; k < points.length - 1; k++) {
    const [x0, y0] = points[k]!;
    const [x1, y1] = points[k + 1]!;
    if (x >= x0 && x <= x1) v = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return v;
}

/** Year-end accounts + CT return, limited company / partnership, by turnover. */
const ACCOUNTS_POINTS: Array<[number, number]> = [
  [25000, 300], [50000, 500], [100000, 700], [150000, 900], [200000, 1200], [250000, 1500],
  [500000, 1800], [750000, 2000], [1000000, 2400], [1500000, 3000], [2000000, 3600],
  [2500000, 4000], [3500000, 4600], [5000000, 5300], [7500000, 6300], [10000000, 7200],
];
export const accountsFee = (turnover: number) => round(interpolate(ACCOUNTS_POINTS, turnover));

/** Turnover choices on the website (the slider was replaced by this list). */
export const TURNOVER_TIERS = ACCOUNTS_POINTS.map(([t]) => t);

/** VAT return base price per quarter, by turnover. */
const VAT_POINTS: Array<[number, number]> = [
  [25000, 60], [50000, 65], [100000, 85], [150000, 100], [200000, 112], [250000, 125],
  [500000, 175], [750000, 210], [1000000, 240], [2500000, 360], [5000000, 495], [10000000, 675],
];
export const vatBasePerQuarter = (turnover: number) => interpolate(VAT_POINTS, turnover);

/** VAT per quarter, including transactions over the allowance and the BTL discount. */
export function vatPerQuarter(turnover: number, transactionsPerQuarter: number, btlCompany = false): number {
  const base = vatBasePerQuarter(turnover);
  const allowance = turnover < 150000 ? 200 : base * 2;
  const extra = Math.max(0, transactionsPerQuarter - allowance);
  let q = base + Math.min(extra, 1000) * 0.4 + Math.max(0, extra - 1000) * 0.2;
  if (btlCompany) q *= 0.75;
  return q;
}

export const payrollRate = (employees: number) => (employees <= 5 ? 10 : employees <= 15 ? 8 : employees <= 30 ? 6 : 5);
/** £200 a year covers two staff; each further employee is charged per pay run. */
export const payrollAnnual = (employees: number, runsPerYear: number) =>
  200 + Math.max(0, employees - 2) * payrollRate(employees) * runsPerYear;

export const cisAnnual = (subcontractors: number) => subcontractors * 10 * 12;
/** Director / partner Self Assessment on a company or partnership quote. */
export const companySaAnnual = (people: number, mtd: boolean) => people * (mtd ? 400 : 200);
/** Sole trader or landlord Self Assessment. */
export function individualSa(opts: { mtd: boolean; couple: boolean; properties: number }): Array<[string, number]> {
  if (!opts.mtd) return [[`Self Assessment${opts.couple ? " (couple)" : ""}`, opts.couple ? 350 : 250]];
  const q = opts.couple ? 75 : 50;
  const lines: Array<[string, number]> = [
    [`MTD quarterly updates (4 × £${q}${opts.couple ? ", couple" : ""})`, q * 4],
    [`MTD annual summary and final declaration${opts.couple ? " (couple)" : ""}`, 250],
  ];
  if (opts.properties > 1) lines.push([`Additional rental properties (${opts.properties - 1} × £15 per quarter)`, (opts.properties - 1) * 60]);
  return lines;
}
/** Sole trader who wants GNS to prepare the figures from their records. */
export const soleFromRecords = (turnover: number) => 100 + 100 * Math.max(0, Math.ceil((turnover - 50000) / 25000));
export const bankAccountsAnnual = (gbpAccounts: number, foreignAccounts: number) =>
  Math.max(0, gbpAccounts - 1) * 40 + foreignAccounts * 90;
export const FLAT = {
  dormantAccounts: 200,
  confirmationStatement: 100,
  cloudBookkeeping: 300,
  registeredOffice: 240,
  managementAccountsShare: 0.35,
  vatRate: 0.2,
  customQuoteOver: 10_000_000,
};

/* ------------------------------------------------------------------ */
/* Checking a quote the website sent                                    */
/* ------------------------------------------------------------------ */

export interface QuoteLineCheck {
  label: string;
  /** What the visitor was shown. */
  quoted: number;
  /** Today's price for the same line, when it can be worked out from the line. */
  current: number | null;
  ok: boolean | null;
  note?: string;
}

export interface QuoteCheck {
  found: boolean;
  businessType: string | null;
  turnover: number | null;
  lines: QuoteLineCheck[];
  quotedTotal: number | null;
  /** Sum of today's prices (quoted figure where a line cannot be re-priced). */
  currentTotal: number;
  customQuote: boolean;
  /** Plain-English problems for staff, not for the client. */
  issues: string[];
}

const money = (s: string) => {
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
};
const num = (s: string | undefined) => (s ? Number(s.replace(/,/g, "")) : NaN);

/**
 * Split a summary into [label, amount] pairs. Two formats have been used:
 *   new: "Accounts and Tax Returns (turnover £250,000) | £1,500"  (one per line)
 *   old: "Accounts (up to 150k turnover): GBP 1000 per year."     (one sentence each)
 */
function summaryPairs(text: string): Array<[string, string]> {
  if (text.includes("|")) {
    return text.split(/\r?\n/).map((l) => l.split("|").map((s) => s.trim()) as [string, string]).filter((p) => p.length >= 2 && p[0] && p[1]);
  }
  return [...text.matchAll(/([^.:]+?):\s*(GBP\s*[\d,]+(?:\.\d+)?)\s*(?:per year)?\.?/gi)].map((m) => [m[1]!.trim(), m[2]!.trim()]);
}

/** True when this text is a website quote summary. */
export function isQuoteSummary(text: string | null | undefined): boolean {
  return !!text && /(Estimated annual fee|tentative quote summary)/i.test(text);
}

export function checkQuote(summary: string | null | undefined): QuoteCheck {
  const empty: QuoteCheck = { found: false, businessType: null, turnover: null, lines: [], quotedTotal: null, currentTotal: 0, customQuote: false, issues: [] };
  if (!isQuoteSummary(summary)) return empty;
  const pairs = summaryPairs(summary!);
  const out: QuoteCheck = { ...empty, found: true };

  // Facts first, so each line can be priced with them.
  for (const [label, value] of pairs) {
    if (/^Business type/i.test(label)) out.businessType = value.replace(/\.$/, "");
    if (/^(Annual turnover|Total annual rental income)/i.test(label) && /over/i.test(value)) out.customQuote = true;
  }
  const typeText = (out.businessType ?? summary!.match(/Business type:\s*([a-z ]+)/i)?.[1] ?? "").toLowerCase();
  const isCompany = /ltd|limited|partnership/.test(typeText);

  for (const [label, value] of pairs) {
    if (/^(Business type|Income and expenses summary|Rental properties|Ownership|Notes|Annual turnover|Total annual rental income)/i.test(label)) continue;
    const quoted = money(value);
    if (isNaN(quoted)) continue;

    if (/^Estimated annual fee \(?excl/i.test(label)) { out.quotedTotal = quoted; continue; }
    if (/^Estimated annual fee \(?incl/i.test(label)) continue;

    const line: QuoteLineCheck = { label: label.replace(/GBP\s?(\d)/g, "£$1"), quoted, current: null, ok: null };
    let m: RegExpMatchArray | null;

    if (/^Accounts and Tax Returns \(dormant\)/i.test(label)) {
      line.current = FLAT.dormantAccounts;
    } else if ((m = label.match(/^Accounts and Tax Returns \(turnover £?([\d,]+)\)/i)) && isCompany) {
      out.turnover = num(m[1]);
      line.current = accountsFee(out.turnover);
    } else if ((m = label.match(/^Accounts \(up to ([\d.]+)k turnover\)/i))) {
      out.turnover = Number(m[1]) * 1000;
      line.current = accountsFee(out.turnover);
    } else if ((m = label.match(/prepared from your records \(turnover up to £([\d,]+)\)/i))) {
      out.turnover = num(m[1]);
      line.current = soleFromRecords(out.turnover);
    } else if ((m = label.match(/^Payroll \(base covers 2 staff \+ (\d+) extra, (\d+) runs\)/i))) {
      const extra = Number(m[1]);
      // With no extra staff the base fee applies whatever the exact head-count (0, 1 or 2).
      line.current = payrollAnnual(extra + 2, Number(m[2]));
    } else if ((m = label.match(/^CIS \((\d+) subcontractors?\)/i))) {
      line.current = cisAnnual(Number(m[1]));
    } else if ((m = label.match(/^Self Assessment \((\d+) at (?:£|GBP)\s?(\d+)( MTD)?\)/i))) {
      const people = Number(m[1]);
      line.current = companySaAnnual(people, Boolean(m[3]));
      if (Number(m[2]) !== (m[3] ? 400 : 200)) line.note = `Rate today is £${m[3] ? 400 : 200} per person`;
    } else if (/^Self Assessment( \(couple\))?$/i.test(label)) {
      line.current = /couple/i.test(label) ? 350 : 250;
    } else if ((m = label.match(/^MTD quarterly updates \(4 × £(\d+)/i))) {
      line.current = /couple/i.test(label) ? 300 : 200;
    } else if (/^MTD annual summary/i.test(label)) {
      line.current = 250;
    } else if ((m = label.match(/^Additional rental properties \((\d+) ×/i))) {
      line.current = Number(m[1]) * 60;
    } else if (/^(Confirmation Statement|Companies House filing)/i.test(label)) {
      line.current = FLAT.confirmationStatement;
    } else if (/^Cloud bookkeeping/i.test(label)) {
      line.current = FLAT.cloudBookkeeping;
    } else if (/^Registered office/i.test(label)) {
      line.current = FLAT.registeredOffice;
    } else if ((m = label.match(/^VAT returns \((?:£|GBP)?\s?(\d+(?:\.\d+)?) per qtr/i))) {
      // Transactions are not in the summary, so the quarterly price is taken as
      // given and checked against today's minimum for the turnover.
      const q = Number(m[1]);
      line.current = round(q * 4);
      if (out.turnover && isCompany) {
        const min = vatPerQuarter(out.turnover, 0, /BTL/i.test(label));
        if (q + 0.5 < min) line.note = `Below today's minimum of £${round(min)} per quarter for this turnover`;
      }
    } else if ((m = label.match(/^Bank \/ card accounts \((?:(\d+) extra GBP)?(?:, )?(?:(\d+) foreign)?\)/i))) {
      line.current = bankAccountsAnnual(Number(m[1] ?? 0) + 1, Number(m[2] ?? 0));
    } else if (/^Management accounts/i.test(label)) {
      const acc = out.lines.find((l) => /^Accounts/i.test(l.label));
      if (acc) line.current = round((acc.current ?? acc.quoted) * FLAT.managementAccountsShare);
    }

    if (line.current !== null) {
      line.ok = Math.abs(line.current - line.quoted) <= 1;
      if (!line.ok && !line.note) line.note = `Today's price is £${line.current.toLocaleString("en-GB")}`;
    }
    out.lines.push(line);
  }

  out.currentTotal = out.lines.reduce((s, l) => s + (l.current ?? l.quoted), 0);
  const quotedSum = out.lines.reduce((s, l) => s + l.quoted, 0);
  if (out.quotedTotal !== null && Math.abs(quotedSum - out.quotedTotal) > 1) {
    out.issues.push(`The quoted lines add up to £${round(quotedSum).toLocaleString("en-GB")}, but the total shown was £${round(out.quotedTotal).toLocaleString("en-GB")}.`);
  }
  for (const l of out.lines) if (l.ok === false || l.note) out.issues.push(`${l.label}: quoted £${round(l.quoted).toLocaleString("en-GB")}. ${l.note ?? ""}`.trim());
  if (out.customQuote) out.issues.push("Turnover over £10m: the website could not price this; a custom quote is needed.");
  if (!out.lines.length) out.issues.push("No priced lines could be read from this quote.");
  return out;
}

export const withVat = (n: number) => round(n * (1 + FLAT.vatRate));
export const perMonth = (n: number) => round(n / 12);
