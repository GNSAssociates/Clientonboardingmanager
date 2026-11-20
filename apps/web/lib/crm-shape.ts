/**
 * Reading what the GNS CRM API returns (crm.gnsuk.com/api/v1).
 *
 * The CRM's own documentation (api-docs/ in the project folder) gives two
 * namings for the same things: the guide's examples use `id`, `name`,
 * `number_o`, `companystatus`; the field reference uses `company_id`,
 * `company_name`, `company_number`, `companies_house_status`. It also says the
 * examples are illustrative and fields may be absent. So every reader here
 * accepts either, and nothing assumes a field is present.
 *
 * Pure: no network, no database. Tested by scripts/test-crm-shape.mts.
 */

export type Json = Record<string, unknown>;

/** The 13 related datasets, in the order the CRM documents them. */
export const CRM_DATASETS = [
  "directors",
  "business-activities",
  "charges",
  "disqualifications",
  "exemptions",
  "filing-history",
  "insolvency",
  "officer-appointments",
  "people-with-significant-control",
  "previous-names",
  "psc-statements",
  "company-registers",
  "uk-establishments",
] as const;
export type CrmDataset = (typeof CRM_DATASETS)[number];

export const CRM_DATASET_LABELS: Record<CrmDataset, string> = {
  directors: "Directors and officers",
  "business-activities": "Business activities (SIC)",
  charges: "Charges",
  disqualifications: "Disqualifications",
  exemptions: "Exemptions",
  "filing-history": "Filing history",
  insolvency: "Insolvency",
  "officer-appointments": "Officer appointments",
  "people-with-significant-control": "People with significant control",
  "previous-names": "Previous names",
  "psc-statements": "PSC statements",
  "company-registers": "Company registers",
  "uk-establishments": "UK establishments",
};

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

/** First present value among several possible field names. */
function pick(o: Json, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = str(o[k]);
    if (v !== null) return v;
  }
  return null;
}

/** UK company numbers are 8 characters; "1234567" and "01234567" are the same company. */
export function normaliseCompanyNumber(v: unknown): string | null {
  const s = (str(v) ?? "").replace(/\s+/g, "").toUpperCase();
  if (!s) return null;
  if (/^\d{1,8}$/.test(s)) return s.padStart(8, "0");
  if (/^[A-Z]{2}\d{1,6}$/.test(s)) return s.slice(0, 2) + s.slice(2).padStart(6, "0");
  return s;
}

/** A date from the CRM as YYYY-MM-DD, or null. Accepts ISO, "YYYY-MM-DD hh:mm:ss" and UK "dd/mm/yyyy". */
export function crmDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}

export interface CrmCompanySummary {
  crmId: string;
  companyName: string | null;
  clientName: string | null;
  companyNumber: string | null;
  companiesHouseStatus: string | null;
  recordStatus: string | null;
  accountsDue: string | null;
  confirmationStatementDue: string | null;
  incorporated: string | null;
  registeredAddress: string | null;
}

/** One company, from a list row or from the `company` part of a detail response. */
export function readCompany(o: Json): CrmCompanySummary | null {
  const crmId = pick(o, "company_id", "id");
  if (!crmId) return null;
  return {
    crmId,
    companyName: pick(o, "company_name", "name", "company"),
    clientName: pick(o, "client_name", "company", "name"),
    companyNumber: normaliseCompanyNumber(pick(o, "company_number", "number_o", "number")),
    companiesHouseStatus: pick(o, "companies_house_status", "companystatus", "company_status"),
    recordStatus: pick(o, "record_status", "status"),
    accountsDue: crmDate(o.accounts_due_date),
    confirmationStatementDue: crmDate(o.confirmation_statement_due_date),
    incorporated: crmDate(o.incorporation_date),
    registeredAddress: pick(o, "registered_address"),
  };
}

export interface CrmPage {
  rows: Json[];
  page: number;
  lastPage: number;
  total: number | null;
}

/**
 * A list page. Laravel paginators put the metadata either at the top level
 * (as the CRM guide shows) or under `meta`; both are read.
 */
export function readListPage(body: unknown, requestedPage: number): CrmPage {
  const b = (body && typeof body === "object" ? body : {}) as Json;
  const data = Array.isArray(b.data) ? b.data : Array.isArray((b.data as Json | undefined)?.data) ? ((b.data as Json).data as unknown[]) : [];
  const meta = (b.meta && typeof b.meta === "object" ? b.meta : (b.data && !Array.isArray(b.data) && typeof b.data === "object" ? b.data : b)) as Json;
  const num = (v: unknown) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
  const page = num(b.current_page) ?? num(meta.current_page) ?? requestedPage;
  const lastPage = num(b.last_page) ?? num(meta.last_page) ?? (data.length ? page + 1 : page);
  return {
    rows: data.filter((r): r is Json => !!r && typeof r === "object"),
    page,
    lastPage,
    total: num(b.total) ?? num(meta.total),
  };
}

export interface CrmDetail {
  company: CrmCompanySummary | null;
  profile: Json;
  datasets: Partial<Record<CrmDataset, Json[]>>;
}

/** A single-company response: the profile plus every related dataset that came back. */
export function readDetail(body: unknown): CrmDetail {
  const b = (body && typeof body === "object" ? body : {}) as Json;
  const data = (b.data && typeof b.data === "object" ? b.data : b) as Json;
  const profile = (data.company && typeof data.company === "object" ? data.company : data) as Json;
  const relatedRaw = (data.related_records ?? data.related ?? data.datasets ?? {}) as Json;
  const datasets: Partial<Record<CrmDataset, Json[]>> = {};
  for (const ds of CRM_DATASETS) {
    // Accept "people-with-significant-control" and "people_with_significant_control".
    const v = relatedRaw[ds] ?? relatedRaw[ds.replace(/-/g, "_")];
    if (Array.isArray(v)) datasets[ds] = v.filter((r): r is Json => !!r && typeof r === "object");
  }
  return { company: readCompany(profile), profile, datasets };
}

/** "Mr John  A. SMITH" and "SMITH, John A" compare equal. Used to link CRM people to people recorded here. */
export function personKey(name: unknown): string | null {
  let s = (str(name) ?? "").toLowerCase();
  if (!s) return null;
  // Companies House style "SURNAME, Forenames" → "forenames surname".
  const comma = s.match(/^([^,]+),\s*(.+)$/);
  if (comma) s = `${comma[2]} ${comma[1]}`;
  const words = s
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(mr|mrs|ms|miss|dr|sir|dame|prof)$/.test(w));
  return words.length ? [...words].sort().join(" ") : null;
}

/** A director or PSC, reduced to what linking and the screen need. */
export interface CrmPerson {
  name: string;
  key: string;
  kind: "director" | "psc";
  role: string | null;
  current: boolean;
  verificationDue: string | null;
  verifiedOn: string | null;
}

export function peopleOf(datasets: Partial<Record<CrmDataset, Json[]>>): CrmPerson[] {
  const out: CrmPerson[] = [];
  for (const d of datasets.directors ?? []) {
    const name = pick(d, "name") ?? [pick(d, "first_name"), pick(d, "other_names"), pick(d, "last_name")].filter(Boolean).join(" ");
    const key = personKey(name);
    if (!key) continue;
    const resigned = crmDate(d.resignation_date);
    const cur = d.current;
    out.push({
      name, key, kind: "director", role: pick(d, "role"),
      current: cur === undefined || cur === null ? !resigned : cur === true || cur === 1 || cur === "1" || cur === "true",
      verificationDue: crmDate(d.verification_due_date),
      verifiedOn: crmDate(d.verification_statement_date),
    });
  }
  for (const p of datasets["people-with-significant-control"] ?? []) {
    const name = pick(p, "person_name", "name");
    const key = personKey(name);
    if (!name || !key) continue;
    out.push({ name, key, kind: "psc", role: pick(p, "control_type"), current: !crmDate(p.ceased_date), verificationDue: null, verifiedOn: null });
  }
  return out;
}

/**
 * A Companies House style name ("SMITH, Jane Mary") as people write it
 * ("Jane Mary Smith"). A name without the comma is returned as it is.
 */
export function displayName(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^([^,]+),\s*(.+)$/);
  if (!m) return s;
  const title = (w: string) => w.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
  const last = m[1]!.trim() === m[1]!.trim().toUpperCase() ? title(m[1]!.trim()) : m[1]!.trim();
  return `${m[2]!.trim()} ${last}`;
}

/**
 * The engagement wizard's client type for a company number: LLPs are
 * registered with OC (England & Wales), SO (Scotland) or NC (Northern
 * Ireland); everything else on the register is treated as a limited company.
 */
export function clientTypeFor(companyNumber: string | null): "limited" | "llp" {
  return /^(OC|SO|NC)/i.test(companyNumber ?? "") ? "llp" : "limited";
}
