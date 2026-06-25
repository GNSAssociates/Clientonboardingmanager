/**
 * Hexagonal ports (A2 §9, NFR-PORT-1). Every external dependency is consumed
 * through one of these interfaces; concrete adapters live in @gns/integrations
 * and are swappable without touching domain logic. Method bodies are filled in
 * per integration module (M4–M7); M0 fixes the contracts.
 */

export interface CompanyProfile {
  companyNumber: string;
  name: string;
  status: string;
  incorporatedOn?: string;
  registeredOffice?: Record<string, unknown>;
  sicCodes?: string[];
}

export interface CompaniesHousePort {
  search(query: string): Promise<CompanyProfile[]>;
  getProfile(companyNumber: string): Promise<CompanyProfile>;
}

export interface LedgerSnapshot {
  kind: "trial_balance" | "ledgers" | "vat" | "payroll" | "coa";
  period?: string;
  payload: Record<string, unknown>;
}

export interface LedgerPort {
  readonly provider: "xero" | "qbo";
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }>;
  pull(kind: LedgerSnapshot["kind"], connectionId: string): Promise<LedgerSnapshot>;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface MailerPort {
  readonly provider: "graph" | "smtp";
  send(message: OutboundEmail): Promise<{ providerRef: string }>;
}

export interface ESignProvider {
  readonly provider: string;
  createEnvelope(input: {
    documentUrl: string;
    signers: { name: string; email: string }[];
  }): Promise<{ envelopeId: string }>;
  void(envelopeId: string): Promise<void>;
}

export interface KycProvider {
  readonly provider: string;
  initiate(input: { name: string; email: string; checks: string[] }): Promise<{ ref: string }>;
  getResult(ref: string): Promise<{ status: string; result: Record<string, unknown> }>;
}

export interface DocExtraction {
  readonly provider: string;
  extract(input: { storagePath: string; mime: string }): Promise<{ fields: Record<string, unknown> }>;
}
