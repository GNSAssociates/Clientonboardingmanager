import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthSession } from "@gns/core";

/**
 * Signed-cookie session encoding for the dev-auth shim (M1).
 *
 * Format: base64url(JSON(session)) + "." + base64url(HMAC-SHA256). The HMAC
 * prevents tampering. This is a *development* identity provider that produces
 * the exact same `AuthSession` shape the real Entra/Supabase adapters will, so
 * swapping them in later requires no changes outside this folder.
 */
const secret = (): string =>
  process.env.AUTH_SHIM_SECRET ?? process.env.WEBHOOK_SIGNING_SECRET ?? "dev-insecure-secret-change-me";

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64url");

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signSession(session: AuthSession): string {
  const body = b64url(JSON.stringify(session));
  return `${body}.${sign(body)}`;
}

export function verifySession(value: string): AuthSession | null {
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AuthSession;
  } catch {
    return null;
  }
}
