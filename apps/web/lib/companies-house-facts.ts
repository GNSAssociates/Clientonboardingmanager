/**
 * The facts the handover checklist needs, taken from Companies House.
 *
 * Two of the checklist's decisions turn on things Companies House already
 * knows, and that nobody should have to look up by hand:
 *
 *   has the company filed accounts before?  — if not, there is no CT600 and no
 *     detailed P&L to ask the previous accountant for, and the item should say
 *     "not applicable, newly incorporated" rather than sit open for weeks.
 *     Roam Ventures, registered a few months ago, is exactly that case.
 *
 *   what date were the last accounts made up to?  — this is the start of the
 *     payroll records we need: accounts to 31 October 2025 means records from
 *     1 November 2025. Getting it wrong leaves a gap nobody notices until the
 *     first payroll is run.
 *
 * Read-only, and never fatal: if Companies House is unreachable or the number
 * is wrong, the facts come back unknown (null) and the checklist asks a person
 * instead of inventing an answer.
 */

export interface CompanyFacts {
  companyNumber: string;
  name: string | null;
  /** Incorporated on — a company months old cannot have filed accounts. */
  incorporatedOn: Date | null;
  /** True when accounts have actually been filed at least once. */
  hasFilingHistory: boolean | null;
  /** The date the last filed accounts were made up to. */
  lastAccountsTo: Date | null;
  /** The next accounts period end, for context on the screen. */
  nextAccountsTo: Date | null;
  /** Dissolved, liquidation, etc. — worth seeing before taking them on. */
  status: string | null;
  /** Set when the lookup failed, so the screen can say so plainly. */
  error?: string;
}

const parseDate = (s: unknown): Date | null => {
  if (typeof s !== "string" || !s.trim()) return null;
  const d = new Date(s + (s.length === 10 ? "T00:00:00Z" : ""));
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function fetchCompanyFacts(companyNumber: string): Promise<CompanyFacts> {
  const number = String(companyNumber || "").trim().toUpperCase();
  const empty: CompanyFacts = {
    companyNumber: number, name: null, incorporatedOn: null,
    hasFilingHistory: null, lastAccountsTo: null, nextAccountsTo: null, status: null,
  };
  if (!number) return { ...empty, error: "no company number" };

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!apiKey) return { ...empty, error: "Companies House key is not configured" };

  const auth = "Basic " + Buffer.from(apiKey + ":").toString("base64");
  const get = (path: string) =>
    fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(number)}${path}`, {
      headers: { Authorization: auth },
      // A slow lookup must never hold up the screen that needs it.
      signal: AbortSignal.timeout(12_000),
    });

  let profileRes: Response, filingRes: Response;
  try {
    [profileRes, filingRes] = await Promise.all([get(""), get("/filing-history?category=accounts&items_per_page=1")]);
  } catch (e) {
    return { ...empty, error: "could not reach Companies House" };
  }

  if (!profileRes.ok) {
    return { ...empty, error: profileRes.status === 404 ? "company number not found" : `Companies House returned ${profileRes.status}` };
  }

  const profile = (await profileRes.json().catch(() => ({}))) as {
    company_name?: string;
    company_status?: string;
    date_of_creation?: string;
    accounts?: { last_accounts?: { made_up_to?: string; type?: string }; next_made_up_to?: string };
  };

  const lastAccountsTo = parseDate(profile.accounts?.last_accounts?.made_up_to);

  /* TWO INDEPENDENT SIGNALS, because either alone can mislead: the profile
     carries a last-accounts date only once something has been filed, and the
     filing history is the record of it. A company that has filed shows both;
     one that has not shows neither. */
  let filedCount: number | null = null;
  if (filingRes.ok) {
    const fh = (await filingRes.json().catch(() => ({}))) as { total_count?: number };
    filedCount = typeof fh.total_count === "number" ? fh.total_count : null;
  }
  const hasFilingHistory =
    lastAccountsTo != null ? true : filedCount != null ? filedCount > 0 : null;

  return {
    companyNumber: number,
    name: profile.company_name ?? null,
    incorporatedOn: parseDate(profile.date_of_creation),
    hasFilingHistory,
    lastAccountsTo,
    nextAccountsTo: parseDate(profile.accounts?.next_made_up_to),
    status: profile.company_status ?? null,
  };
}
