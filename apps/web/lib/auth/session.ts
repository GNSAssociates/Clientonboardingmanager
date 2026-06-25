import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authorize, type AuthSession, type Capability } from "@gns/core";
import { verifySession } from "./cookie";

export const SESSION_COOKIE = "gns_session";

/** Resolve the current session from the signed cookie (null if anonymous). */
export function getSession(): AuthSession | null {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  return raw ? verifySession(raw) : null;
}

/** Require a session; redirect to dev-login if absent. */
export function requireSession(): AuthSession {
  const session = getSession();
  if (!session) redirect("/dev-login");
  return session;
}

/** Require a capability (PRD §7.2); 403 via ForbiddenError, or redirect if anon. */
export function requireCapability(capability: Capability): AuthSession {
  const session = requireSession();
  authorize(session, capability); // throws ForbiddenError if missing
  return session;
}
