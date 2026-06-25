import { ROLES } from "@gns/config";
import { getDb, closeDb } from "./client";
import { entities, roles } from "./schema/tenancy";
import { services } from "./schema/services";

/**
 * Seed script (A3 §8). Idempotent: roles + the three white-label entities with
 * REALISTIC PLACEHOLDER config (BR-ENT-*). Replace bank/AML/signatory details
 * with real values via the admin UI (confirmed during PRD §18). Run with a
 * superuser/service connection: `pnpm --filter @gns/db seed` (needs DATABASE_URL).
 */
const ENTITY_SEED = [
  {
    code: "GNS",
    legalName: "GNS Associates Limited",
    tradingName: "GNS Associates",
    brand: { primaryColor: "#1f3a5f", accentColor: "#2f8f6b", fontFamily: "Inter" },
    address: { line1: "1 Example Street", city: "London", postcode: "EC1A 1AA", country: "United Kingdom" },
    bankDetails: { accountName: "GNS Associates Limited", sortCode: "00-00-00", accountNumber: "00000000", bankName: "Example Bank" },
    signatory: { name: "A. Khan", role: "Director" },
    amlSupervisor: { body: "ICAEW", registrationNumber: "C0000001" },
    vatNumber: "GB000000001",
    companyNumber: "00000001",
  },
  {
    code: "LLP",
    legalName: "GNS LLP",
    tradingName: "GNS LLP",
    brand: { primaryColor: "#23304f", accentColor: "#1f7fb0", fontFamily: "Inter" },
    address: { line1: "1 Example Street", city: "London", postcode: "EC1A 1AA", country: "United Kingdom" },
    bankDetails: { accountName: "GNS LLP", sortCode: "00-00-00", accountNumber: "00000001", bankName: "Example Bank" },
    signatory: { name: "A. Khan", role: "Designated Member" },
    amlSupervisor: { body: "ACCA", registrationNumber: "0000002" },
    vatNumber: "GB000000002",
    companyNumber: "OC000001",
  },
  {
    code: "GXY",
    legalName: "GXY Accountancy Limited",
    tradingName: "GXY",
    brand: { primaryColor: "#3a2a5f", accentColor: "#b0469a", fontFamily: "Inter" },
    address: { line1: "2 Example Avenue", city: "Manchester", postcode: "M1 1AA", country: "United Kingdom" },
    bankDetails: { accountName: "GXY Accountancy Limited", sortCode: "00-00-00", accountNumber: "00000002", bankName: "Example Bank" },
    signatory: { name: "R. Patel", role: "Director" },
    amlSupervisor: { body: "ICAEW", registrationNumber: "C0000003" },
    vatNumber: "GB000000003",
    companyNumber: "00000003",
  },
];

const SERVICE_SEED = [
  { code: "bookkeeping", name: "Bookkeeping", requiresClearance: true, requiredDocuments: ["Bank statements (3 months)", "Prior period ledgers"] },
  { code: "vat", name: "VAT returns", requiresClearance: true, requiredDocuments: ["VAT registration certificate", "Last VAT return"] },
  { code: "paye", name: "PAYE / Payroll", requiresClearance: true, requiredDocuments: ["PAYE reference", "Latest payroll report"] },
  { code: "cis", name: "CIS", requiresClearance: true, requiredDocuments: ["CIS registration", "Latest CIS statements"] },
  { code: "accounts", name: "Year-end accounts", requiresClearance: true, requiredDocuments: ["Prior year accounts", "Trial balance"] },
  { code: "self_assessment", name: "Self Assessment", requiresClearance: false, requiredDocuments: ["UTR", "Income summary"] },
  { code: "corporation_tax", name: "Corporation Tax", requiresClearance: true, requiredDocuments: ["CT UTR", "Prior CT600"] },
  { code: "confirmation_statement", name: "Confirmation Statement", requiresClearance: false, requiredDocuments: [] },
];

async function seed(): Promise<void> {
  const db = getDb();

  await db
    .insert(roles)
    .values(ROLES.map((name) => ({ name })))
    .onConflictDoNothing({ target: roles.name });

  await db.insert(entities).values(ENTITY_SEED).onConflictDoNothing({ target: entities.code });

  await db.insert(services).values(SERVICE_SEED).onConflictDoNothing({ target: services.code });

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${ROLES.length} roles, ${ENTITY_SEED.length} entities, ${SERVICE_SEED.length} services.`,
  );
  await closeDb();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
