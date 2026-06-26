import type { LedgerPort, LedgerSnapshot } from "@gns/core";

const QBO_AUTH = "https://appcenter.intuit.com/connect/oauth2";
const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";

function hasQboCredentials(): boolean {
  return !!(process.env["QBO_CLIENT_ID"] && process.env["QBO_CLIENT_SECRET"]);
}

const STUB_SNAPSHOTS: Record<LedgerSnapshot["kind"], LedgerSnapshot> = {
  trial_balance: {
    kind: "trial_balance",
    period: "2024-04-01/2025-03-31",
    payload: { rows: [{ account: "Sales", balance: 115000 }, { account: "Expenses", balance: 42000 }] },
  },
  ledgers: {
    kind: "ledgers",
    period: "2024-04-01/2025-03-31",
    payload: { transactions: [] },
  },
  vat: {
    kind: "vat",
    period: "2025-Q1",
    payload: { taxLines: [] },
  },
  payroll: {
    kind: "payroll",
    period: "2025-01",
    payload: { employees: 3, totalPayroll: 18000 },
  },
  coa: {
    kind: "coa",
    payload: { accounts: [] },
  },
};

export const qboAdapter: LedgerPort = {
  provider: "qbo",

  getAuthUrl(state: string): string {
    if (!hasQboCredentials()) return `#qbo-stub-auth?state=${state}`;
    const params = new URLSearchParams({
      client_id: process.env["QBO_CLIENT_ID"]!,
      redirect_uri: process.env["QBO_REDIRECT_URI"] ?? "http://localhost:3000/api/integrations/qbo/callback",
      response_type: "code",
      scope: "com.intuit.quickbooks.accounting",
      state,
    });
    return `${QBO_AUTH}?${params}`;
  },

  async exchangeCode(code: string) {
    if (!hasQboCredentials()) {
      return {
        accessToken: `qbo-stub-access-${Date.now()}`,
        refreshToken: `qbo-stub-refresh-${Date.now()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };
    }
    const creds = Buffer.from(`${process.env["QBO_CLIENT_ID"]}:${process.env["QBO_CLIENT_SECRET"]}`).toString("base64");
    const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env["QBO_REDIRECT_URI"] ?? "",
      }),
    });
    if (!res.ok) throw new Error(`QBO token exchange failed: ${res.status}`);
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
    if (!hasQboCredentials()) {
      return STUB_SNAPSHOTS[kind] ?? { kind, payload: {} };
    }
    void connectionId;
    return STUB_SNAPSHOTS[kind] ?? { kind, payload: {} };
  },
};
