import "server-only";
import type { AuthSession } from "@gns/core";
import type { Role } from "@gns/config";

/**
 * Dev session presets (M1). One preset per role so any flow can be exercised
 * locally before the real Entra/Supabase adapters are wired. `entityIds` are
 * resolved at login time from the seeded entities (see dev-login action).
 */
export const DEV_PRESETS: { label: string; roles: Role[]; isClient?: boolean }[] = [
  { label: "Admin", roles: ["Admin"] },
  { label: "Partner", roles: ["Partner"] },
  { label: "Manager", roles: ["Manager"] },
  { label: "Onboarding Staff", roles: ["OnboardingStaff"] },
  { label: "Reviewer", roles: ["Reviewer"] },
  { label: "Compliance Officer", roles: ["ComplianceOfficer"] },
  { label: "Client", roles: ["Client"], isClient: true },
];

/** Stable, valid UUIDs per role so dev sessions write cleanly to uuid columns. */
const DEV_USER_IDS: Record<string, string> = {
  Admin: "00000000-0000-4000-8000-000000000001",
  Partner: "00000000-0000-4000-8000-000000000002",
  Manager: "00000000-0000-4000-8000-000000000003",
  OnboardingStaff: "00000000-0000-4000-8000-000000000004",
  Reviewer: "00000000-0000-4000-8000-000000000005",
  ComplianceOfficer: "00000000-0000-4000-8000-000000000006",
  Client: "00000000-0000-4000-8000-000000000007",
};

export function buildDevSession(
  roles: Role[],
  entityIds: string[],
  opts: { clientId?: string; displayName?: string } = {},
): AuthSession {
  const primary = roles[0] ?? "OnboardingStaff";
  return {
    userId: DEV_USER_IDS[primary] ?? "00000000-0000-4000-8000-000000000000",
    displayName: opts.displayName ?? `Dev ${primary}`,
    roles,
    entityIds: roles.includes("Client") ? [] : entityIds,
    clientId: opts.clientId,
    isAdmin: roles.includes("Admin"),
  };
}

// Provisional auth shim — always enabled until real Entra/Supabase auth is wired
export const isDevAuthEnabled = (): boolean => true;
