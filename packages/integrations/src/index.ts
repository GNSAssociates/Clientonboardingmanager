import type {
  CompaniesHousePort,
  DocExtraction,
  ESignProvider,
  KycProvider,
  LedgerPort,
  MailerPort,
} from "@gns/core";
import { stubDocExtractionAdapter } from "./adapters/doc-extraction.stub";
import { dropboxSignStubAdapter } from "./adapters/dropbox-sign.stub";
import { companiesHouseAdapter } from "./adapters/companies-house.stub";
import { amiqusStubAdapter } from "./adapters/amiqus.stub";

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
  esign: dropboxSignStubAdapter,
  companiesHouse: companiesHouseAdapter,
  kyc: amiqusStubAdapter,
};

export { stubDocExtractionAdapter, dropboxSignStubAdapter, companiesHouseAdapter, amiqusStubAdapter };
