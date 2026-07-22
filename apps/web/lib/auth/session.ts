import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authorize, type AuthSession, type Capability } from "@gns/core";
import { verifySession } from "./cookie";

export const SESSION_COOKIE = "gns_session";

export function getSession(): AuthSession | null {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  return raw ? verifySession(raw) : null;
}

export function requireSession(): AuthSession {
  const session = getSession();
  if (!session) redirect("/login");
  return session;
}

export function requireCapability(capability: Capability): AuthSession {
  const session = requireSession();
  authorize(session, capability);
  return session;
}
