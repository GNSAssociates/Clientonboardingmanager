/**
 * Domain constants shared across app, services, agents and DB (A1 §11, PRD §7).
 * Single source of truth for enumerated values so UI, API and schema agree.
 */

/** Onboarding case primary states (A3 §4, mirrors PRD §11). */
export const CASE_STATUSES = [
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
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_SUBSTATUSES = ["on_hold", "blocked", "rejected", "cancelled"] as const;
export type CaseSubstatus = (typeof CASE_SUBSTATUSES)[number];

/** RBAC roles (PRD §7.1). */
export const ROLES = [
  "Admin",
  "Partner",
  "Manager",
  "OnboardingStaff",
  "Reviewer",
  "ComplianceOfficer",
  "Client",
  "System",
] as const;
export type Role = (typeof ROLES)[number];

/** Review areas (FR-LED-3). */
export const REVIEW_AREAS = [
  "bookkeeping",
  "vat",
  "paye",
  "cis",
  "accounts",
  "trial_balance",
] as const;
export type ReviewArea = (typeof REVIEW_AREAS)[number];

/** AI agents (FR-AI-1). */
export const AGENTS = [
  "orchestrator",
  "document_classifier",
  "missing_info_detector",
  "compliance_reviewer",
  "risk_assessor",
  "client_communicator",
  "prev_accountant_communicator",
  "ledger_reviewer",
] as const;
export type AgentName = (typeof AGENTS)[number];

/** Default confidence threshold for auto-accepting AI classification (A2 §6). */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.85;
