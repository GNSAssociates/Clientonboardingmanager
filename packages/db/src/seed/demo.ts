// @ts-nocheck
import { getDb } from "../client";
import { randomBytes } from "crypto";

const uuid = () => crypto.randomUUID();

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const STAFF_ID = "00000000-0000-4000-8000-000000000003";

export async function seedDemo() {
  const db = getDb();

  // Get existing entities
  const entities = await db.query.entities.findMany();
  if (entities.length === 0) {
    console.log("❌ No entities found. Run entity seed first.");
    return;
  }

  const gnsEntity = entities.find((e) => e.name === "GNS Associates");
  if (!gnsEntity) {
    console.log("❌ GNS Associates entity not found");
    return;
  }

  const entityId = gnsEntity.id;

  // Demo clients
  const clients = [
    {
      id: uuid(),
      entityId,
      name: "Tech Innovations Ltd",
      companyNumber: "12345678",
      registeredAddress: "123 Silicon Valley, London, SW1A 1AA",
      type: "limited",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      entityId,
      name: "Sarah's Consulting",
      companyNumber: "87654321",
      registeredAddress: "456 Business Park, Manchester, M1 1AA",
      type: "sole_trader",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      entityId,
      name: "Global Trading Partners LLP",
      companyNumber: "11223344",
      registeredAddress: "789 Commerce Street, Edinburgh, EH1 3AA",
      type: "partnership",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  console.log("📌 Seeding demo clients...");
  for (const client of clients) {
    await db.insert(db.schema.clients).values(client);
  }

  // Demo cases
  const cases = [
    {
      id: uuid(),
      entityId,
      clientId: clients[0].id,
      status: "company_verified",
      startedAt: new Date("2024-01-15"),
      completedAt: null,
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-20"),
    },
    {
      id: uuid(),
      entityId,
      clientId: clients[1].id,
      status: "kyc_cdd",
      startedAt: new Date("2024-02-01"),
      completedAt: null,
      createdAt: new Date("2024-02-01"),
      updatedAt: new Date("2024-02-10"),
    },
    {
      id: uuid(),
      entityId,
      clientId: clients[2].id,
      status: "auth_letter_signed",
      startedAt: new Date("2023-12-01"),
      completedAt: null,
      createdAt: new Date("2023-12-01"),
      updatedAt: new Date("2024-01-30"),
    },
  ];

  console.log("📌 Seeding demo cases...");
  for (const case_ of cases) {
    await db.insert(db.schema.onboardingCases).values(case_);
  }

  // Demo services
  const services = [
    {
      id: uuid(),
      entityId,
      name: "Bookkeeping",
      description: "Monthly transaction entry and reconciliation",
      category: "accounting",
      basePrice: 150,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      entityId,
      name: "VAT Returns",
      description: "Quarterly VAT return filing",
      category: "tax",
      basePrice: 200,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      entityId,
      name: "PAYE & NIC",
      description: "Payroll and HMRC compliance",
      category: "payroll",
      basePrice: 250,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      entityId,
      name: "Annual Accounts",
      description: "Year-end statutory accounts",
      category: "accounting",
      basePrice: 500,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      entityId,
      name: "Tax Planning",
      description: "Strategic tax advice",
      category: "tax",
      basePrice: 300,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      entityId,
      name: "CIS Compliance",
      description: "Construction Industry Scheme support",
      category: "compliance",
      basePrice: 180,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  console.log("📌 Seeding demo services...");
  for (const service of services) {
    await db.insert(db.schema.services).values(service);
  }

  // Demo compliance checks
  const complianceChecks = [
    {
      id: uuid(),
      entityId,
      caseId: cases[0].id,
      clientId: clients[0].id,
      checkType: "companies_house",
      status: "passed",
      details: { companyNumber: clients[0].companyNumber, verified: true },
      completedAt: new Date("2024-01-20"),
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-20"),
    },
    {
      id: uuid(),
      entityId,
      caseId: cases[1].id,
      clientId: clients[1].id,
      checkType: "kyc",
      status: "in_progress",
      details: { idVerified: false },
      completedAt: null,
      createdAt: new Date("2024-02-01"),
      updatedAt: new Date("2024-02-10"),
    },
  ];

  console.log("📌 Seeding demo compliance checks...");
  for (const check of complianceChecks) {
    await db.insert(db.schema.complianceChecks).values(check);
  }

  // Demo onboarding links
  const onboardingLinks = [
    {
      id: uuid(),
      entityId,
      clientId: clients[0].id,
      token: randomBytes(32).toString("hex"),
      companyNumber: clients[0].companyNumber,
      companyName: clients[0].name,
      clientEmail: "contact@techinnovations.com",
      status: "accepted" as const,
      sentAt: new Date("2024-01-15"),
      expiresAt: new Date("2024-02-15"),
      acceptedAt: new Date("2024-01-16"),
      resendCount: "0",
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-16"),
    },
    {
      id: uuid(),
      entityId,
      clientId: clients[1].id,
      token: randomBytes(32).toString("hex"),
      companyNumber: clients[1].companyNumber,
      companyName: clients[1].name,
      clientEmail: "sarah@consultingco.com",
      status: "sent" as const,
      sentAt: new Date("2024-02-01"),
      expiresAt: new Date("2024-03-02"),
      acceptedAt: null,
      resendCount: "1",
      lastResentAt: new Date("2024-02-05"),
      createdAt: new Date("2024-02-01"),
      updatedAt: new Date("2024-02-05"),
    },
    {
      id: uuid(),
      entityId,
      token: randomBytes(32).toString("hex"),
      companyNumber: "99999999",
      companyName: "Test Company Ltd",
      clientEmail: "test@example.com",
      status: "sent" as const,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      acceptedAt: null,
      resendCount: "0",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  console.log("📌 Seeding demo onboarding links...");
  for (const link of onboardingLinks) {
    await db.insert(db.schema.onboardingLinks).values(link);
  }

  console.log("✅ Demo data seeded successfully!");
  console.log(`   - ${clients.length} demo clients`);
  console.log(`   - ${cases.length} demo cases`);
  console.log(`   - ${services.length} demo services`);
  console.log(`   - ${complianceChecks.length} demo compliance checks`);
  console.log(`   - ${onboardingLinks.length} demo onboarding links`);
  console.log("\n📋 Demo onboarding links (for testing):");
  onboardingLinks.forEach((link) => {
    console.log(`   - ${link.companyName} (${link.clientEmail}) - Status: ${link.status}`);
    console.log(`     Token: ${link.token.substring(0, 16)}...`);
    console.log(`     URL: /onboarding/engage/${link.token}`);
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo().then(() => process.exit(0)).catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
}
