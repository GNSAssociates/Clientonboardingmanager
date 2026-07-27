import "server-only";
import { createHmac } from "node:crypto";

/**
 * Single sign-on handoff token for the Invoice Summarizer app.
 *
 * The main platform mints this short-lived, HMAC-signed token and embeds it in
 * the invoice-app iframe URL (`/api/auth/sso?token=…`). The invoice app shares
 * the same SSO_SHARED_SECRET, verifies the token, and starts its own session —
 * so the user is never asked to log in twice.
 *
 * Returns null when SSO_SHARED_SECRET is unset, in which case the caller embeds
 * the plain URL and the invoice app's own login is used (safe fallback).
 */
const secret = (): string => process.env.SSO_SHARED_SECRET ?? "";

export interface SsoTokenInput {
  email: string;
  name?: string;
  role?: "admin" | "staff";
  ttlMs?: number;
}

export function makeSsoToken(input: SsoTokenInput): string | null {
  const s = secret();
  if (!s || !input.email) return null;
  const payload = {
    email: input.email.toLowerCase(),
    name: input.name,
    role: input.role ?? "staff",
    exp: Date.now() + (input.ttlMs ?? 5 * 60 * 1000), // 5 minutes
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", s).update(body).digest("base64url");
  return `${body}.${sig}`;
}
