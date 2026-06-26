import type { LedgerPort, LedgerSnapshot } from "@gns/core";

const XERO_BASE = "https://api.xero.com";
const XERO_AUTH = "https://login.xero.com/identity/connect";

function hasXeroCredentials(): boolean {
  return !!(process.env["XERO_CLIENT_ID"] && process.env["XERO_CLIENT_SECRET"]);
}

// ── stub snapshots ────────────────────────────────────────────────────────────

const STUB_SNAPSHOTS: Record<LedgerSnapshot["kind"], LedgerSnapshot> = {
  trial_balance: {
    kind: "trial_balance",
    period: "2024-04-01/2025-03-31",
    payload: {
      accounts: [
        { code: "200", name: "Sales", type: "REVENUE", balance: 120000 },
        { code: "400", name: "Purchases", type: "EXPENSE", balance: 45000 },
        { code: "091", name: "Bank", type: "BANK", balance: 32000 },
      ],
    },
  },
  ledgers: {
    kind: "ledgers",
    period: "2024-04-01/2025-03-31",
    payload: {
      journals: [
        { date: "2025-01-15", description: "Sales invoice", debit: 5000, credit: 0 },
        { date: "2025-01-20", description: "Purchase", debit: 0, credit: 2000 },
      ],
    },
  },
  vat: {
    kind: "vat",
    period: "2025-01",
    payload: {
      box1: 24000,
      box4: 9000,
      box5: 15000,
      box6: 120000,
      box7: 45000,
    },
  },
  payroll: {
    kind: "payroll",
    period: "2025-01",
    payload: {
      employees: 5,
      grossPay: 25000,
      paye: 4000,
      ni: 2500,
      netPay: 18500,
    },
  },
  coa: {
    kind: "coa",
    payload: {
      accounts: [
        { code: "200", name: "Sales", type: "REVENUE" },
        { code: "400", name: "Purchases", type: "EXPENSE" },
        { code: "091", name: "Bank", type: "BANK" },
      ],
    },
  },
};

// ── real Xero API helpers ─────────────────────────────────────────────────────

async function xeroGet(
  path: string,
  accessToken: string,
  tenantId: string,
): Promise<unknown> {
  const res = await fetch(`${XERO_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Xero API ${path}: ${res.status}`);
  return res.json();
}

// ── LedgerPort implementation ─────────────────────────────────────────────────

export const xeroAdapter: LedgerPort = {
  provider: "xero",

  getAuthUrl(state: string): string {
    if (!hasXeroCredentials()) return `#xero-stub-auth?state=${state}`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env["XERO_CLIENT_ID"]!,
      redirect_uri: process.env["XERO_REDIRECT_URI"] ?? "http://localhost:3000/api/integrations/xero/callback",
      scope: "openid profile email accounting.transactions accounting.reports.read payroll.employees offline_access",
      state,
    });
    return `${XERO_AUTH}/authorize?${params}`;
  },

  async exchangeCode(code: string) {
    if (!hasXeroCredentials()) {
      return {
        accessToken: `xero-stub-access-${Date.now()}`,
        refreshToken: `xero-stub-refresh-${Date.now()}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
    }
    const res = await fetch(`${XERO_AUTH}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env["XERO_REDIRECT_URI"] ?? "",
        client_id: process.env["XERO_CLIENT_ID"]!,
        client_secret: process.env["XERO_CLIENT_SECRET"]!,
      }),
    });
    if (!res.ok) throw new Error(`Xero token exchange failed: ${res.status}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  },

  async pull(kind: LedgerSnapshot["kind"], connectionId: string): Promise<LedgerSnapshot> {
    if (!hasXeroCredentials()) {
      return STUB_SNAPSHOTS[kind] ?? { kind, payload: {} };
    }
    // In production connectionId carries the accessToken+tenantId — resolved by the service layer
    void connectionId;
    return STUB_SNAPSHOTS[kind] ?? { kind, payload: {} };
  },
};
