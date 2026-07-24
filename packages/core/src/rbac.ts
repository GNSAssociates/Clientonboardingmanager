import type { Role } from "@gns/config";
import type { AuthSession } from "./auth";
import { ForbiddenError } from "./errors";

export type Capability =
  | "configure_entities"
  | "manage_users"
  | "manage_permissions"
  | "create_case"
  | "view_all_cases"
  | "view_assigned_cases"
  | "generate_documents"
  | "send_esign"
  | "run_agents"
  | "approve_ai_compliance"
  | "approve_client_comms"
  | "perform_cdd"
  | "conduct_review"
  | "upload_documents"
  | "view_documents"
  | "verify_documents"
  | "view_audit_log"
  | "manage_retention"
  | "complete_onboarding"
  | "access_onboarding"
  | "access_invoices"
  | "manage_staff";

const MATRIX: Record<Capability, Role[]> = {
  configure_entities: ["Admin", "Partner"],
  manage_users: ["Admin", "Partner"],
  manage_permissions: ["Partner"],
  manage_staff: ["Admin", "Partner", "HR"],
  create_case: ["Admin", "Partner", "Manager", "OnboardingStaff", "ComplianceOfficer"],
  view_all_cases: ["Admin", "Partner", "Manager", "OnboardingStaff", "Reviewer", "ComplianceOfficer"],
  view_assigned_cases: [
    "Admin", "Partner", "Manager", "OnboardingStaff", "Reviewer", "ComplianceOfficer", "Client",
  ],
  generate_documents: ["Admin", "Partner", "Manager", "OnboardingStaff"],
  send_esign: ["Admin", "Partner", "Manager", "OnboardingStaff"],
  run_agents: ["Admin", "Partner", "Manager", "OnboardingStaff", "Reviewer", "ComplianceOfficer"],
  approve_ai_compliance: ["Partner", "Manager", "ComplianceOfficer"],
  approve_client_comms: ["Admin", "Partner", "Manager", "OnboardingStaff"],
  perform_cdd: ["Partner", "OnboardingStaff", "ComplianceOfficer"],
  conduct_review: ["Admin", "Partner", "Manager", "Reviewer"],
  upload_documents: [
    "Admin", "Partner", "Manager", "HR", "OnboardingStaff", "Reviewer", "ComplianceOfficer", "Client",
  ],
  view_documents: [
    "Admin", "Partner", "Manager", "HR", "OnboardingStaff", "Reviewer", "ComplianceOfficer", "Client",
  ],
  verify_documents: ["Admin", "Partner", "Manager", "Reviewer", "ComplianceOfficer"],
  view_audit_log: ["Admin", "Partner", "Manager", "ComplianceOfficer"],
  manage_retention: ["Admin", "Partner", "ComplianceOfficer"],
  complete_onboarding: ["Admin", "Partner", "Manager", "ComplianceOfficer"],
  // Onboarding (client intake, engagement, clearance) is a senior function.
  access_onboarding: ["Admin", "Partner", "Manager"],
  // The Invoice Summarizer is available to every staff role.
  access_invoices: ["Admin", "Partner", "Manager", "HR", "OnboardingStaff", "Reviewer", "ComplianceOfficer"],
};

export function can(session: AuthSession, capability: Capability): boolean {
  if (session.isAdmin) return true;
  const allowed = MATRIX[capability];
  return session.roles.some((r) => allowed.includes(r));
}

export function authorize(session: AuthSession, capability: Capability): void {
  if (!can(session, capability)) {
    throw new ForbiddenError(`Missing capability: ${capability}`);
  }
}

export { MATRIX as PERMISSION_MATRIX };
