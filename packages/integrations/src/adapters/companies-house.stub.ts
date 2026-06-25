import type { CompaniesHousePort, CompanyProfile } from "@gns/core";

/**
 * Companies House adapter (M5).
 * Uses the public Companies House REST API (no auth for basic company lookups).
 * In production set CH_API_KEY in env (basic auth, username=key, password=empty).
 *
 * Dev stub: returns plausible fixture data when CH_API_KEY is absent or
 * when NODE_ENV=test.
 */
const CH_BASE = "https://api.company-information.service.gov.uk";

export const companiesHouseAdapter: CompaniesHousePort = {
  async search(query) {
    if (!process.env["CH_API_KEY"]) {
      return [stubProfile(query)];
    }
    return searchReal(query);
  },

  async getProfile(companyNumber) {
    if (!process.env["CH_API_KEY"]) {
      return stubProfile(companyNumber);
    }
    return getProfileReal(companyNumber);
  },
};

/* ── stub ─────────────────────────────────────────────────────────────────── */
function stubProfile(query: string): CompanyProfile {
  return {
    companyNumber: query.match(/^\d{8}$/) ? query : "12345678",
    name: "Acme Ltd (stub)",
    status: "active",
    incorporatedOn: "2010-01-15",
    registeredOffice: {
      addressLine1: "1 Stub Street",
      locality: "London",
      postalCode: "EC1A 1AA",
      country: "England",
    },
    sicCodes: ["62020"],
  };
}

/* ── real API ─────────────────────────────────────────────────────────────── */
function authHeaders() {
  const key = process.env["CH_API_KEY"]!;
  const encoded = Buffer.from(`${key}:`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

async function searchReal(query: string): Promise<CompanyProfile[]> {
  const url = `${CH_BASE}/search/companies?q=${encodeURIComponent(query)}&items_per_page=5`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Companies House search failed: ${res.status}`);
  const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
  return (data.items ?? []).map(mapProfile);
}

async function getProfileReal(companyNumber: string): Promise<CompanyProfile> {
  const url = `${CH_BASE}/company/${encodeURIComponent(companyNumber)}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Companies House getProfile failed: ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  return mapProfile(data);
}

function mapProfile(d: Record<string, unknown>): CompanyProfile {
  const addr = d["registered_office_address"] as Record<string, unknown> | undefined;
  return {
    companyNumber: String(d["company_number"] ?? ""),
    name: String(d["company_name"] ?? d["title"] ?? ""),
    status: String(d["company_status"] ?? "unknown"),
    incorporatedOn: d["date_of_creation"] as string | undefined,
    registeredOffice: addr,
    sicCodes: (d["sic_codes"] as string[] | undefined) ?? [],
  };
}
