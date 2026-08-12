/**
 * Companies House filing-deadline helper.
 *
 * Reads a company's next accounts due date and next confirmation-statement due
 * date from Companies House and computes days remaining + an urgency band, so
 * the practice can see what's due soon across the client base. Reuses the same
 * Basic-auth pattern as the existing CH routes (COMPANIES_HOUSE_API_KEY).
 *
 * Results are cached in-memory (deadlines move at most once a year) so a
 * portfolio view doesn't hammer the CH API on every page load.
 */

const CH_BASE = "https://api.companieshouse.gov.uk";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export type DeadlineUrgency = "overdue" | "due-soon" | "upcoming" | "ok" | "unknown";

export interface CompanyDeadlines {
  companyNumber: string;
  companyName: string | null;
  accountsDue: string | null;          // YYYY-MM-DD
  accountsDaysLeft: number | null;
  confirmationDue: string | null;      // YYYY-MM-DD
  confirmationDaysLeft: number | null;
  nextDeadline: string | null;         // the sooner of the two
  nextDeadlineType: "accounts" | "confirmation" | null;
  nextDeadlineDaysLeft: number | null;
  urgency: DeadlineUrgency;
  error?: string;
}

const cache = new Map<string, { at: number; value: CompanyDeadlines }>();

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  const today = new Date();
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((t - midnight) / 86400000);
}

function bandFor(daysLeft: number | null): DeadlineUrgency {
  if (daysLeft == null) return "unknown";
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 30) return "due-soon";
  if (daysLeft <= 90) return "upcoming";
  return "ok";
}

function normaliseNumber(raw: string): string {
  const s = raw.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]/.test(s) ? s : s.padStart(8, "0"); // LLP/SC prefixes aren't zero-padded
}

/** Fetch (and cache) a single company's filing deadlines. Never throws. */
export async function fetchCompanyDeadlines(companyNumberRaw: string): Promise<CompanyDeadlines> {
  const companyNumber = normaliseNumber(companyNumberRaw);
  const cached = cache.get(companyNumber);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const base: CompanyDeadlines = {
    companyNumber, companyName: null,
    accountsDue: null, accountsDaysLeft: null,
    confirmationDue: null, confirmationDaysLeft: null,
    nextDeadline: null, nextDeadlineType: null, nextDeadlineDaysLeft: null,
    urgency: "unknown",
  };

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!apiKey) return { ...base, error: "Companies House API key not configured" };

  try {
    const res = await fetch(`${CH_BASE}/company/${companyNumber}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` },
    });
    if (!res.ok) return { ...base, error: res.status === 404 ? "Company not found" : `CH API error ${res.status}` };
    const data: any = await res.json();

    const accountsDue = data.accounts?.next_due ?? data.accounts?.next_accounts?.due_on ?? null;
    const confirmationDue = data.confirmation_statement?.next_due ?? null;
    const accountsDaysLeft = daysUntil(accountsDue);
    const confirmationDaysLeft = daysUntil(confirmationDue);

    // The sooner of the two future/overdue dates is the headline deadline.
    let nextDeadline: string | null = null;
    let nextDeadlineType: "accounts" | "confirmation" | null = null;
    let nextDeadlineDaysLeft: number | null = null;
    const candidates: Array<{ d: string | null; left: number | null; type: "accounts" | "confirmation" }> = [
      { d: accountsDue, left: accountsDaysLeft, type: "accounts" },
      { d: confirmationDue, left: confirmationDaysLeft, type: "confirmation" },
    ];
    for (const c of candidates) {
      if (c.d == null || c.left == null) continue;
      if (nextDeadlineDaysLeft == null || c.left < nextDeadlineDaysLeft) {
        nextDeadline = c.d; nextDeadlineType = c.type; nextDeadlineDaysLeft = c.left;
      }
    }

    const value: CompanyDeadlines = {
      companyNumber,
      companyName: data.company_name ?? null,
      accountsDue, accountsDaysLeft,
      confirmationDue, confirmationDaysLeft,
      nextDeadline, nextDeadlineType, nextDeadlineDaysLeft,
      urgency: bandFor(nextDeadlineDaysLeft),
    };
    cache.set(companyNumber, { at: Date.now(), value });
    return value;
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Could not reach Companies House" };
  }
}

/**
 * Fetch deadlines for many companies with bounded concurrency (kind to the CH
 * API and to the host's process limits — these are async fetches, NPROC-safe).
 * Returns them sorted by soonest deadline first (overdue at the top).
 */
export async function fetchDeadlinesForCompanies(
  companyNumbers: string[],
  concurrency = 5,
): Promise<CompanyDeadlines[]> {
  const unique = Array.from(new Set(companyNumbers.map((n) => n?.trim()).filter(Boolean) as string[]));
  const results: CompanyDeadlines[] = [];
  let i = 0;
  async function worker() {
    while (i < unique.length) {
      const n = unique[i++];
      if (!n) continue;
      results.push(await fetchCompanyDeadlines(n));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  // Sort: known deadlines first (soonest/overdue first), unknowns last.
  return results.sort((a, b) => {
    if (a.nextDeadlineDaysLeft == null && b.nextDeadlineDaysLeft == null) return 0;
    if (a.nextDeadlineDaysLeft == null) return 1;
    if (b.nextDeadlineDaysLeft == null) return -1;
    return a.nextDeadlineDaysLeft - b.nextDeadlineDaysLeft;
  });
}
