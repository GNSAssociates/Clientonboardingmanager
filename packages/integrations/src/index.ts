import type {
  CompaniesHousePort,
  DocExtraction,
  ESignProvider,
  KycProvider,
  LedgerPort,
  MailerPort,
} from "@gns/core";
import { stubDocExtractionAdapter } from "./adapters/doc-extraction.stub";

/**
 * Adapter registry (A2 §9). Concrete adapters are registered here per module:
 *   M3 → DocExtraction stub (Azure Doc AI in M5)
 *   M4 → ESignProvider (Dropbox Sign), MailerPort (Graph + SMTP fallback)
 *   M5 → CompaniesHousePort, KycProvider (Amiqus), DocExtraction (Azure Doc AI real)
 *   M7 → LedgerPort (Xero, then QuickBooks)
 */
export interface AdapterRegistry {
  companiesHouse?: CompaniesHousePort;
  ledger?: Record<string, LedgerPort>;
  mailer?: MailerPort;
  esign?: ESignProvider;
  kyc?: KycProvider;
  docExtraction?: DocExtraction;
}

export const adapters: AdapterRegistry = {
  docExtraction: stubDocExtractionAdapter,
};

export { stubDocExtractionAdapter };
