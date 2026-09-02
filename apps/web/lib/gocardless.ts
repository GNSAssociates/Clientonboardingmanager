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
 *   GOCARDLESS_WEBHOOK_SECRET        — default webhook signing secret (all firms)
 *   GOCARDLESS_WEBHOOK_SECRET_GNS    — per-firm overrides, same pattern as the
 *   GOCARDLESS_WEBHOOK_SECRET_LLP      access token (each firm's GoCardless
 *   GOCARDLESS_WEBHOOK_SECRET_GALAXY   account has its own webhook endpoint/secret)
 *
 * Without a token the mandate details are stored in the database for manual
 * setup and this module is a no-op — signing is never blocked.
 *
 * Mandate *creation* (this file) is synchronous and only ever reaches
 * "pending_submission" — true confirmation that the mandate is usable only
 * arrives later via a GoCardless webhook (see apps/web/app/api/webhooks/
 * gocardless/route.ts), which is why callers that must gate on a *confirmed*
 * mandate (not just a created one) hold the client in a "pending_dd" state
 * until that webhook fires.
 */
import { createHmac, timingSafeEqual } from 'crypto';

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

export interface BankLookupResult {
  configured: boolean;
  ok: boolean;
  bankName?: string;
  supportsBacs?: boolean;
  error?: string;
}

/**
 * Validate a UK sort code + account number against GoCardless's Bank Details
 * Lookup API and return the resolved bank name — exactly what the GoCardless
 * hosted page shows as the client types. Lightweight single HTTP call (no CPU
 * work), so it is NPROC-safe; the caller debounces it.
 */
export async function lookupBankDetails(
  firmSlug: string,
  accountNumber: string,
  sortCode: string,
): Promise<BankLookupResult> {
  const gcToken = tokenForFirm(firmSlug);
  if (!gcToken) return { configured: false, ok: false };
  const branchCode = sortCode.replace(/\D/g, '');
  const accNo = accountNumber.replace(/\D/g, '');
  if (branchCode.length !== 6 || accNo.length < 6 || accNo.length > 8) {
    return { configured: true, ok: false, error: 'incomplete' };
  }
  try {
    const res = await fetch(`${apiBase()}/bank_details_lookups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gcToken}`,
        'GoCardless-Version': '2015-07-06',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bank_details_lookups: { account_number: accNo, branch_code: branchCode, country_code: 'GB' } }),
    });
    const json = await res.json().catch(() => ({})) as {
      bank_details_lookups?: { bank_name?: string | null; available_debit_schemes?: string[] };
      error?: { message?: string };
    };
    if (!res.ok) return { configured: true, ok: false, error: json.error?.message ?? `lookup ${res.status}` };
    const lk = json.bank_details_lookups;
    const bankName = lk?.bank_name ?? undefined;
    if (!bankName) return { configured: true, ok: false, error: 'These bank details were not recognised. Please check and try again.' };
    return {
      configured: true,
      ok: true,
      bankName,
      supportsBacs: (lk?.available_debit_schemes ?? []).includes('bacs'),
    };
  } catch (e) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message : 'lookup failed' };
  }
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

  /* A 409 IS NOT A FAILURE — it is idempotency working.
   *
   * The keys here are derived from the onboarding token, which is the point:
   * the same client must not end up with two mandates. But that meant the
   * SECOND attempt — a client who closed the GoCardless page and came back, or
   * simply clicked twice — was shown
   *   "billing_requests 409: A resource has already been created with this
   *    idempotency key"
   * and could go no further. The resource they needed already existed; we were
   * just refusing to hand it to them.
   *
   * GoCardless returns the existing resource's id on the conflict, so fetch it
   * and carry on exactly as if we had created it.
   */
  if (res.status === 409) {
    const conflict = (json as {
      error?: { links?: { conflicting_resource_id?: string } };
    }).error?.links?.conflicting_resource_id;
    if (conflict) {
      const existing = await fetch(`${apiBase()}${path}/${conflict}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'GoCardless-Version': '2015-07-06',
        },
      });
      const got = await existing.json().catch(() => ({})) as Record<string, Record<string, unknown>>;
      if (existing.ok && got[resource]) return got[resource];
    }
  }

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
  /** Structured billing address (GoCardless field shape). Optional — sent on the
   *  customer when present so mandates carry a proper address for BACS. */
  address?: {
    line1?: string; line2?: string; city?: string; region?: string; postcode?: string;
  };
}): Promise<GcResult> {
  const gcToken = tokenForFirm(opts.firmSlug);
  if (!gcToken) return { configured: false, success: false };

  try {
    const a = opts.address;
    const customer = await gcPost(gcToken, '/customers', 'customers', {
      email: opts.email,
      given_name: opts.directorName.split(' ')[0] || opts.directorName,
      family_name: opts.directorName.split(' ').slice(1).join(' ') || opts.directorName,
      company_name: opts.companyName,
      country_code: 'GB',
      // GoCardless customer address fields (only included when we have them).
      ...(a?.line1?.trim() ? { address_line1: a.line1.trim() } : {}),
      ...(a?.line2?.trim() ? { address_line2: a.line2.trim() } : {}),
      ...(a?.city?.trim() ? { city: a.city.trim() } : {}),
      ...(a?.region?.trim() ? { region: a.region.trim() } : {}),
      ...(a?.postcode?.trim() ? { postal_code: a.postcode.trim() } : {}),
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
      // Lets staff cross-reference a mandate in the GoCardless dashboard back
      // to the onboarding link; the webhook handler uses our own DB lookup
      // (by mandate id), not this, so it's a convenience field, not load-bearing.
      metadata: { onboarding_token: opts.token },
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

/**
 * BILLING REQUESTS flow (modern GoCardless). Accounts that return 403 on the
 * direct /customers + /mandates endpoints must use this: we create a billing
 * request (a BACS mandate authorisation) + a hosted flow, then redirect the
 * client to GoCardless's secure page to enter their bank details and confirm.
 * When they finish, the billing request becomes `fulfilled` and a mandate is
 * created — that is our "DD set up" signal (verified on redirect-return AND by
 * webhook). No bank details ever touch our servers.
 */
export async function createDirectDebitBillingRequest(opts: {
  firmSlug: string;
  companyName: string;
  directorName: string;
  email: string;
  token: string;
  redirectUri: string;
  exitUri: string;
}): Promise<{ configured: boolean; success: boolean; authorisationUrl?: string; billingRequestId?: string; error?: string }> {
  const gcToken = tokenForFirm(opts.firmSlug);
  if (!gcToken) return { configured: false, success: false };
  try {
    const br = await gcPost(gcToken, '/billing_requests', 'billing_requests', {
      mandate_request: { scheme: 'bacs', currency: 'GBP' },
      metadata: { onboarding_token: opts.token },
    }, `br-${opts.token}`);

    const flow = await gcPost(gcToken, '/billing_request_flows', 'billing_request_flows', {
      redirect_uri: opts.redirectUri,
      exit_uri: opts.exitUri,
      // Pre-fill what we know so the hosted page is faster for the client.
      prefilled_customer: {
        email: opts.email,
        given_name: opts.directorName.split(' ')[0] || opts.directorName,
        family_name: opts.directorName.split(' ').slice(1).join(' ') || undefined,
        company_name: opts.companyName || undefined,
      },
      links: { billing_request: br.id },
      // Unique per attempt, on purpose. The billing REQUEST is reused so the
      // client never ends up with two mandates, but a billing request FLOW is
      // single-use and expires — reusing its key handed a returning client a
      // dead authorisation link.
    }, `brf-${opts.token}-${Date.now().toString(36)}`);

    return {
      configured: true,
      success: true,
      authorisationUrl: String((flow as { authorisation_url?: string }).authorisation_url ?? ''),
      billingRequestId: String(br.id),
    };
  } catch (e) {
    console.error('GoCardless billing request failed:', e);
    return { configured: true, success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Fetch a billing request's status. `fulfilled` = the client completed the DD
 * setup and a mandate was created (our sign-gate condition).
 */
export async function getBillingRequestStatus(
  firmSlug: string,
  billingRequestId: string,
): Promise<{ configured: boolean; status?: string; fulfilled?: boolean; mandateId?: string; error?: string }> {
  const gcToken = tokenForFirm(firmSlug);
  if (!gcToken) return { configured: false };
  try {
    const res = await fetch(`${apiBase()}/billing_requests/${billingRequestId}`, {
      headers: { Authorization: `Bearer ${gcToken}`, 'GoCardless-Version': '2015-07-06' },
    });
    const json = (await res.json().catch(() => ({}))) as {
      billing_requests?: { status?: string; links?: { mandate_request_mandate?: string } };
    };
    if (!res.ok) return { configured: true, error: `GoCardless ${res.status}` };
    const br = json.billing_requests ?? {};
    const mandateId = br.links?.mandate_request_mandate;
    return {
      configured: true,
      status: br.status,
      fulfilled: br.status === 'fulfilled',
      mandateId: mandateId ? String(mandateId) : undefined,
    };
  } catch (e) {
    return { configured: true, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Verify a GoCardless webhook request's `Webhook-Signature` header (HMAC-SHA256
 * hex digest of the raw request body). We don't know which firm's GoCardless
 * account an incoming webhook belongs to until we've located the matching
 * mandate in our own DB — which happens after signature verification — so we
 * just try every configured secret and accept the request if any one matches.
 * Must be called with the raw (unparsed) request body text.
 */
export function verifyGoCardlessWebhookSignature(rawBody: string, signatureHeader: string | null | undefined): boolean {
  if (!signatureHeader) return false;
  const secrets = ['', '_GNS', '_LLP', '_GALAXY']
    .map((suffix) => process.env[`GOCARDLESS_WEBHOOK_SECRET${suffix}`]?.trim())
    .filter((s): s is string => Boolean(s));
  if (!secrets.length) return false;

  const sigBuf = Buffer.from(signatureHeader, 'hex');
  return secrets.some((secret) => {
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
    return expected.length === sigBuf.length && timingSafeEqual(expected, sigBuf);
  });
}
