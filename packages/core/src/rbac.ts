import type { Role } from "@gns/config";
import type { AuthSession } from "./auth";
import { ForbiddenError } from "./errors";

/**
 * Capability-based RBAC (PRD §7.2). Capabilities are the matrix rows; each maps
 * to the roles that hold *any* access to it. Fine-grained scoping (entity / own
 * record) is enforced additionally at the data layer (RLS + service checks);
 * `can()` is the capability gate. Admin holds every capability.
 */
export type Capability =
  | "configure_entities"
  | "manage_users"
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
  | "view_audit_log"
  | "manage_retention"
  | "complete_onboarding";

const MATRIX: Record<Capability, Role[]> = {
  configure_entities: ["Admin", "Partner"],
  manage_users: ["Admin", "Partner"],
  create_case: ["Admin", "Partner", "Manager", "OnboardingStaff", "ComplianceOfficer"],
  view_all_cases: ["Admin", "Partner", "Manager", "OnboardingStaff", "Reviewer", "ComplianceOfficer"],
  view_assigned_cases: [
    "Admin",
    "Partner",
    "Manager",
    "OnboardingStaff",
    "Reviewer",
    "ComplianceOfficer",
    "Client",
  ],
  generate_documents: ["Admin", "Partner", "Manager", "OnboardingStaff"],
  send_esign: ["Admin", "Partner", "Manager", "OnboardingStaff"],
  run_agents: ["Admin", "Partner", "Manager", "OnboardingStaff", "Reviewer", "ComplianceOfficer"],
  approve_ai_compliance: ["Partner", "Manager", "ComplianceOfficer"],
  approve_client_comms: ["Admin", "Partner", "Manager", "OnboardingStaff"],
  perform_cdd: ["Partner", "OnboardingStaff", "ComplianceOfficer"],
  conduct_review: ["Admin", "Partner", "Manager", "Reviewer"],
  upload_documents: [
    "Admin",
    "Partner",
    "Manager",
    "OnboardingStaff",
    "Reviewer",
    "ComplianceOfficer",
    "Client",
  ],
  view_documents: [
    "Admin",
    "Partner",
    "Manager",
    "OnboardingStaff",
    "Reviewer",
    "ComplianceOfficer",
    "Client",
  ],
  view_audit_log: ["Admin", "Partner", "Manager", "ComplianceOfficer"],
  manage_retention: ["Admin", "Partner", "ComplianceOfficer"],
  complete_onboarding: ["Admin", "Partner", "Manager", "ComplianceOfficer"],
};

/** Does this session hold the capability? Admin always does. */
export function can(session: AuthSession, capability: Capability): boolean {
  if (session.isAdmin) return true;
  const allowed = MATRIX[capability];
  return session.roles.some((r) => allowed.includes(r));
}

/** Assert a capability; throws ForbiddenError (HTTP 403) if absent. */
export function authorize(session: AuthSession, capability: Capability): void {
  if (!can(session, capability)) {
    throw new ForbiddenError(`Missing capability: ${capability}`);
  }
}

export { MATRIX as PERMISSION_MATRIX };
