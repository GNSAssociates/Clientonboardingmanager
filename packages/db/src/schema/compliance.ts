import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  cddOutcomeEnum,
  complianceGateEnum,
  kycStatusEnum,
  riskRatingEnum,
  sanctionStatusEnum,
} from "./enums";
import { onboardingCases } from "./cases";
import { entities } from "./tenancy";
import { clients } from "./clients";

// ── companies_house_records ───────────────────────────────────────────────────
export const companiesHouseRecords = pgTable(
  "companies_house_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    companyNumber: text("company_number").notNull(),
    companyName: text("company_name"),
    companyStatus: text("company_status"),
    companyType: text("company_type"),
    incorporatedOn: text("incorporated_on"),
    registeredAddress: jsonb("registered_address"),
    sicCodes: jsonb("sic_codes"),
    officers: jsonb("officers"),
    pscData: jsonb("psc_data"),
    filingHistory: jsonb("filing_history"),
    rawResponse: jsonb("raw_response"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("ch_records_case_idx").on(t.caseId),
    companyNumberIdx: index("ch_records_company_number_idx").on(t.companyNumber),
  }),
);

// ── kyc_checks ────────────────────────────────────────────────────────────────
export const kycChecks = pgTable(
  "kyc_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    provider: text("provider").notNull().default("amiqus"),
    providerRef: text("provider_ref"),
    checkType: text("check_type").notNull().default("standard"),
    status: kycStatusEnum("status").notNull().default("pending"),
    result: jsonb("result"),
    initiatedAt: timestamp("initiated_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    initiatedBy: uuid("initiated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("kyc_checks_case_idx").on(t.caseId),
  }),
);

// ── cdd_records ───────────────────────────────────────────────────────────────
export const cddRecords = pgTable(
  "cdd_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    outcome: cddOutcomeEnum("outcome").notNull().default("standard"),
    pepFlag: boolean("pep_flag").notNull().default(false),
    sanctionsFlag: boolean("sanctions_flag").notNull().default(false),
    adverseMediaFlag: boolean("adverse_media_flag").notNull().default(false),
    sourceOfFunds: text("source_of_funds"),
    sourceOfWealth: text("source_of_wealth"),
    businessActivity: text("business_activity"),
    notes: text("notes"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    nextReviewDue: timestamp("next_review_due", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("cdd_records_case_idx").on(t.caseId),
  }),
);

// ── risk_assessments ──────────────────────────────────────────────────────────
export const riskAssessments = pgTable(
  "risk_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    riskRating: riskRatingEnum("risk_rating").notNull(),
    overallScore: text("overall_score"),
    factors: jsonb("factors"),
    reasoning: text("reasoning"),
    confidence: text("confidence"),
    agentRunId: uuid("agent_run_id"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("risk_assessments_case_idx").on(t.caseId),
  }),
);

// ── sanctions_screenings ──────────────────────────────────────────────────────
export const sanctionsScreenings = pgTable(
  "sanctions_screenings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    screeningType: text("screening_type").notNull().default("sanctions_pep"),
    status: sanctionStatusEnum("status").notNull().default("clear"),
    matches: jsonb("matches"),
    notes: text("notes"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("sanctions_screenings_case_idx").on(t.caseId),
  }),
);

// ── compliance_gates ──────────────────────────────────────────────────────────
export const complianceGates = pgTable(
  "compliance_gates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => onboardingCases.id),
    gateName: text("gate_name").notNull(),
    status: complianceGateEnum("status").notNull().default("pending"),
    notes: text("notes"),
    passedBy: uuid("passed_by"),
    passedAt: timestamp("passed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    caseIdx: index("compliance_gates_case_idx").on(t.caseId),
    gateNameIdx: index("compliance_gates_gate_name_idx").on(t.caseId, t.gateName),
  }),
);

/* ── relations ────────────────────────────────────────────────────────────── */
export const kycChecksRelations = relations(kycChecks, ({ one }) => ({
  case: one(onboardingCases, { fields: [kycChecks.caseId], references: [onboardingCases.id] }),
}));

export const riskAssessmentsRelations = relations(riskAssessments, ({ one }) => ({
  case: one(onboardingCases, { fields: [riskAssessments.caseId], references: [onboardingCases.id] }),
}));
