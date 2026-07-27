import "server-only";
import { getModuleAccessMap } from "@gns/db";
import type { AuthSession } from "@gns/core";

/**
 * Which modules a staff member can reach — the runtime answer used by the
 * dashboard, the onboarding layout and the invoices page.
 *
 * The Partner permissions panel edits the `module_access` table; this helper
 * reads it. If the table is empty or a DB read fails, it falls back to the
 * hard-coded role rules below, so access is NEVER broken by the panel.
 *
 * Admin and Partner always have full access (they can never be locked out,
 * regardless of what the table says).
 */

// Static fallback = the role rules that have always worked.
const STATIC_ONBOARDING: string[] = ["Admin", "Partner", "Manager"];
const STATIC_INVOICE: string[] = [
  "Admin", "Partner", "Manager", "HR", "OnboardingStaff", "Reviewer", "ComplianceOfficer",
];

/** Staff roles the Partner can configure (Admin/Partner are always-on, shown locked). */
export const STAFF_ROLES: string[] = [
  "Admin", "Partner", "Manager", "HR", "OnboardingStaff", "Reviewer", "ComplianceOfficer",
];

/** Roles whose access can never be reduced (safety — no self-lockout). */
export const LOCKED_ROLES: string[] = ["Admin", "Partner"];

export interface ModuleAccess {
  onboarding: boolean;
  invoice: boolean;
}

/** The hard-coded default for a single role. */
export function staticRoleAccess(role: string): ModuleAccess {
  return {
    onboarding: STATIC_ONBOARDING.includes(role),
    invoice: STATIC_INVOICE.includes(role),
  };
}

function staticAccess(session: AuthSession): ModuleAccess {
  if (session.isAdmin) return { onboarding: true, invoice: true };
  return {
    onboarding: session.roles.some((r) => STATIC_ONBOARDING.includes(r)),
    invoice: session.roles.some((r) => STATIC_INVOICE.includes(r)),
  };
}

/** Resolve the effective module access for a session (table + fallback). */
export async function resolveModuleAccess(session: AuthSession): Promise<ModuleAccess> {
  // Admin & Partner are always full-access — cannot be locked out.
  if (session.isAdmin || session.roles.some((r) => LOCKED_ROLES.includes(r))) {
    return { onboarding: true, invoice: true };
  }
  try {
    const map = await getModuleAccessMap();
    if (!map || Object.keys(map).length === 0) return staticAccess(session);
    let onboarding = false;
    let invoice = false;
    for (const r of session.roles) {
      const m = map[r] ?? staticRoleAccess(r); // unconfigured role → static default
      onboarding = onboarding || m.onboarding;
      invoice = invoice || m.invoice;
    }
    return { onboarding, invoice };
  } catch (e) {
    console.error("resolveModuleAccess: DB read failed, using static rules:", e);
    return staticAccess(session);
  }
}
