import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { AuthSession } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { resolveModuleAccess } from "@/lib/auth/module-access";

/**
 * Who may see leads: staff with onboarding access, the same people the staff
 * area lets in. Leads are strangers' contact details, so the API checks this
 * itself rather than relying on the page being hidden.
 */
export async function leadsSession(): Promise<AuthSession | null> {
  const session = getSession();
  if (!session) return null;
  const access = await resolveModuleAccess(session);
  return access.onboarding ? session : null;
}

/**
 * The shared secret WordPress sends with each enquiry.
 *
 * Compared in constant time, and refused outright when the server has no
 * secret set, so a missing setting can never mean "anyone may post leads".
 * LEADS_WEBHOOK_SECRET may hold several values separated by commas, so a new
 * secret can be rolled out to the website before the old one is retired.
 */
export function leadsSecretConfigured(): boolean {
  return secrets().length > 0;
}

export function checkLeadsSecret(presented: string | null | undefined): boolean {
  if (!presented) return false;
  const given = Buffer.from(presented.trim(), "utf8");
  return secrets().some((s) => {
    const want = Buffer.from(s, "utf8");
    return want.length === given.length && timingSafeEqual(want, given);
  });
}

function secrets(): string[] {
  return (process.env.LEADS_WEBHOOK_SECRET ?? "")
    .split(",")
    .map((s) => s.trim())
    // A short secret is a guessable one; ignore it rather than accept it.
    .filter((s) => s.length >= 24);
}
