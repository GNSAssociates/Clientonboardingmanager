import type { Role } from "@gns/config";

/**
 * Authenticated session (A2 §10). Produced by an IdentityProvider:
 *   - staff  → Microsoft Entra ID (real adapter lands when creds are provided)
 *   - client → Supabase Auth
 *   - dev    → signed-cookie shim (M1), behind this same shape
 *
 * Carries the RBAC + RLS context: roles, the entities the user may access, and
 * (for clients) the owning client id. The service layer authorises against this
 * and the DB layer sets matching RLS GUCs (see @gns/db withSession).
 */
export interface AuthSession {
  userId: string;
  displayName?: string;
  roles: Role[];
  /** Entities the user may access. Empty for a Client (scoped by clientId). */
  entityIds: string[];
  /** Set when the principal is a Client (portal). */
  clientId?: string;
  isAdmin: boolean;
}

/** Identity resolution contract (web adapters implement this). */
export interface IdentityProvider {
  readonly kind: "entra" | "supabase" | "dev";
  resolveSession(token: string | undefined): Promise<AuthSession | null>;
}

export function hasRole(session: AuthSession, role: Role): boolean {
  return session.isAdmin || session.roles.includes(role);
}

export function canAccessEntity(session: AuthSession, entityId: string): boolean {
  return session.isAdmin || session.entityIds.includes(entityId);
}

export function isClient(session: AuthSession): boolean {
  return session.roles.includes("Client") && typeof session.clientId === "string";
}
