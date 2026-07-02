/**
 * GoCardless Direct Debit engine.
 *
 * When the client signs the engagement letter and provides bank details, a
 * customer + bank account + BACS mandate are created automatically against the
 * signing firm's GoCardless account.
 *
 * Configuration (Vercel env vars — set when ready):
 *   GOCARDLESS_ACCESS_TOKEN          — default token (all firms)
 *   GOCARDLESS_ACCESS_TOKEN_GNS      — per-firm overrides (GNS / LLP / GALAXY)
 *   GOCARDLESS_ACCESS_TOKEN_LLP
 *   GOCARDLESS_ACCESS_TOKEN_GALAXY
 *   GOCARDLESS_ENVIRONMENT           — "live" (default) or "sandbox"
 *
 * Without a token the mandate details are stored in the database for manual
 * setup and this module is a no-op — signing is never blocked.
 */

export interface DdDetails {
  accountName: string;
  accountNumber: string;
  sortCode: string;
  bankAddress?: string;
}

export interface GcResult {
  configured: boolean;
  success: boolean;
  customerId?: string;
  bankAccountId?: string;
  mandateId?: string;
  error?: string;
}

function tokenForFirm(firmSlug: string): string | undefined {
  const perFirm = process.env[`GOCARDLESS_ACCESS_TOKEN_${firmSlug.toUpperCase()}`];
  return (perFirm || process.env.GOCARDLESS_ACCESS_TOKEN)?.trim() || undefined;
}

function apiBase(): string {
  return process.env.GOCARDLESS_ENVIRONMENT === 'sandbox'
    ? 'https://api-sandbox.gocardless.com'
    : 'https://api.gocardless.com';
}

async function gcPost(token: string, path: string, resource: string, body: Record<string, unknown>, idempotencyKey: string) {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'GoCardless-Version': '2015-07-06',
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ [resource]: body }),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json as { error?: { message?: string } }).error;
    throw new Error(`GoCardless ${path} ${res.status}: ${err?.message ?? JSON.stringify(json).slice(0, 200)}`);
  }
  return (json as Record<string, Record<string, unknown>>)[resource]!;
}

/**
 * Create customer → bank account → BACS mandate. Returns a result object and
 * never throws — callers store the outcome and continue.
 */
export async function setupDirectDebitMandate(opts: {
  firmSlug: string;
  companyName: string;
  directorName: string;
  email: string;
  dd: DdDetails;
  token: string; // onboarding link token — used for idempotency
}): Promise<GcResult> {
  const gcToken = tokenForFirm(opts.firmSlug);
  if (!gcToken) return { configured: false, success: false };

  try {
    const customer = await gcPost(gcToken, '/customers', 'customers', {
      email: opts.email,
      given_name: opts.directorName.split(' ')[0] || opts.directorName,
      family_name: opts.directorName.split(' ').slice(1).join(' ') || opts.directorName,
      company_name: opts.companyName,
      country_code: 'GB',
    }, `cust-${opts.token}`);

    const bankAccount = await gcPost(gcToken, '/customer_bank_accounts', 'customer_bank_accounts', {
      account_holder_name: opts.dd.accountName.slice(0, 18),
      account_number: opts.dd.accountNumber,
      branch_code: opts.dd.sortCode.replace(/\D/g, ''),
      country_code: 'GB',
      currency: 'GBP',
      links: { customer: customer.id },
    }, `bank-${opts.token}`);

    const mandate = await gcPost(gcToken, '/mandates', 'mandates', {
      scheme: 'bacs',
      links: { customer_bank_account: bankAccount.id },
    }, `mand-${opts.token}`);

    return {
      configured: true,
      success: true,
      customerId: String(customer.id),
      bankAccountId: String(bankAccount.id),
      mandateId: String(mandate.id),
    };
  } catch (e) {
    console.error('GoCardless mandate setup failed:', e);
    return { configured: true, success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
