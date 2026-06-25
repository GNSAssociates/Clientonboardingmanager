import type {
  CompaniesHousePort,
  DocExtraction,
  ESignProvider,
  KycProvider,
  LedgerPort,
  MailerPort,
} from "@gns/core";

/**
 * Adapter registry (A2 §9). Concrete adapters are registered here per module:
 *   M4 → ESignProvider (Dropbox Sign), MailerPort (Graph + SMTP fallback)
 *   M5 → CompaniesHousePort, KycProvider (Amiqus), DocExtraction (Azure Doc AI)
 *   M7 → LedgerPort (Xero, then QuickBooks)
 *
 * M0 fixes the shape; adapters are added behind these slots so the domain layer
 * depends only on the port types (NFR-PORT-1).
 */
export interface AdapterRegistry {
  companiesHouse?: CompaniesHousePort;
  ledger?: Record<string, LedgerPort>;
  mailer?: MailerPort;
  esign?: ESignProvider;
  kyc?: KycProvider;
  docExtraction?: DocExtraction;
}

export const adapters: AdapterRegistry = {};
