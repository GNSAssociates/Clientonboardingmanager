import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Postgres enums for fixed sets (A3 §1). Kept centrally so every table shares
 * one definition and migrations stay consistent. Values mirror @gns/config
 * constants (single source of truth across DB / API / UI).
 */

export const authProviderEnum = pgEnum("auth_provider", ["entra", "supabase"]);

export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);

export const roleEnum = pgEnum("role_name", [
  "Admin",
  "Partner",
  "Manager",
  "OnboardingStaff",
  "Reviewer",
  "ComplianceOfficer",
  "Client",
  "System",
]);

export const actorTypeEnum = pgEnum("actor_type", ["user", "system", "agent"]);

export const eventStatusEnum = pgEnum("event_status", [
  "pending",
  "dispatched",
  "failed",
  "dead",
]);

// ── M2 domain enums (mirror @gns/config constants) ──────────────────────────
export const clientTypeEnum = pgEnum("client_type", [
  "limited",
  "sole_trader",
  "partnership",
  "llp",
  "individual",
]);

export const clientStatusEnum = pgEnum("client_status", [
  "prospect",
  "onboarding",
  "active",
  "declined",
  "offboarded",
]);

export const caseStatusEnum = pgEnum("case_status", [
  "lead",
  "service_selection",
  "pricing_agreed",
  "company_verified",
  "kyc_cdd",
  "risk_assessed",
  "auth_letter_signed",
  "engagement_signed",
  "clearance_requested",
  "handover",
  "ledger_connected",
  "reviews_in_progress",
  "docs_complete",
  "compliance_passed",
  "tasks_created",
  "completed",
]);

export const caseSubstatusEnum = pgEnum("case_substatus", [
  "on_hold",
  "blocked",
  "rejected",
  "cancelled",
]);

export const riskRatingEnum = pgEnum("risk_rating", ["low", "medium", "high"]);

export const checklistStatusEnum = pgEnum("checklist_status", [
  "pending",
  "received",
  "verified",
  "na",
]);

export const responsibleEnum = pgEnum("responsible_party", ["client", "staff"]);

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);

export const taskSourceEnum = pgEnum("task_source", ["auto", "manual"]);

export const pricingModelEnum = pgEnum("pricing_model", ["fixed", "tiered", "custom"]);

// ── M4 generated document + e-sign enums ─────────────────────────────────────
export const generatedDocTypeEnum = pgEnum("generated_doc_type", [
  "auth_letter",
  "engagement_letter",
  "clearance_request",
  "handover_letter",
  "other",
]);

export const esignStatusEnum = pgEnum("esign_status", [
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "voided",
  "expired",
]);

// ── M3 document enums ────────────────────────────────────────────────────────
export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "received",
  "verified",
  "rejected",
]);

export const documentCategoryEnum = pgEnum("document_category", [
  "id_document",
  "proof_of_address",
  "bank_statement",
  "vat_return",
  "payroll_record",
  "accounts",
  "tax_return",
  "company_formation",
  "contract",
  "other",
]);

export const classificationSourceEnum = pgEnum("classification_source", [
  "auto",
  "manual",
  "agent",
]);

// ── M5 compliance enums ───────────────────────────────────────────────────────
export const kycStatusEnum = pgEnum("kyc_status", [
  "pending",
  "in_progress",
  "passed",
  "failed",
  "expired",
]);

export const cddOutcomeEnum = pgEnum("cdd_outcome", [
  "standard",
  "enhanced",
  "simplified",
  "refused",
]);

export const sanctionStatusEnum = pgEnum("sanction_status", [
  "clear",
  "potential_match",
  "confirmed_match",
  "false_positive",
]);

export const complianceGateEnum = pgEnum("compliance_gate", [
  "pending",
  "passed",
  "failed",
  "overridden",
]);
