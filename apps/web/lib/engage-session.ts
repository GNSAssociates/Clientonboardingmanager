/**
 * Short-lived proof that a client passed the emailed 2FA code on a signing
 * link.
 *
 * Before this existed, "verified" lived only in React state, so every refresh —
 * and every return from GoCardless — sent the client back to the code screen,
 * for a code that had usually already expired. That is not security, it is an
 * obstacle course in the middle of signing a contract.
 *
 * The proof is a signed cookie, and it is deliberately narrow:
 *   • ONE engagement link  — the cookie name carries that link's fingerprint,
 *                            so passing 2FA on one letter proves nothing about
 *                            another;
 *   • ONE network address  — bound to the IP that answered the code, so the
 *                            cookie is worthless if it is copied elsewhere;
 *   • THIRTY minutes, absolute — refreshing does not extend it. Still on the
 *                            page at 30 minutes? The code is asked for again.
 *
 * It is HMAC-signed with AUTH_SHIM_SECRET and httpOnly, so the browser cannot
 * read or forge it; nothing but the expiry and the address is inside it.
 */
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export const ENGAGE_SESSION_MINUTES = 30;

function secret(): string {
  // Same secret the staff auth cookies are signed with — it is already required
  // in production, so this cannot silently fall back to an empty key.
  return process.env.AUTH_SHIM_SECRET?.trim() || '';
}

/** Short fingerprint of the onboarding token — never the token itself, which
 *  would put a signing credential in a cookie name. */
function fingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

export function engageCookieName(token: string): string {
  return `eng_v_${fingerprint(token)}`;
}

/** The client's network address, as the proxy reports it. */
export function clientIp(req: NextRequest): string {
  const fwd = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  return fwd || req.headers.get('x-real-ip') || 'unknown';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Issue a proof for this token + address, valid for 30 minutes from now. */
export function issueEngageSession(token: string, ip: string): { value: string; maxAge: number } {
  const expiresAt = Date.now() + ENGAGE_SESSION_MINUTES * 60_000;
  const payload = Buffer.from(
    JSON.stringify({ f: fingerprint(token), ip, exp: expiresAt }),
  ).toString('base64url');
  return { value: `${payload}.${sign(payload)}`, maxAge: ENGAGE_SESSION_MINUTES * 60 };
}

export interface EngageSession {
  valid: boolean;
  /** Why it is not valid — surfaced to the page so it can say "your 30 minutes
   *  are up" rather than silently throwing up the code screen again. */
  reason?: 'none' | 'malformed' | 'bad_signature' | 'expired' | 'different_network';
  expiresAt?: number;
}

/** Check a cookie value against this token and address. */
export function readEngageSession(raw: string | undefined, token: string, ip: string): EngageSession {
  if (!raw) return { valid: false, reason: 'none' };
  if (!secret()) return { valid: false, reason: 'none' };

  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return { valid: false, reason: 'malformed' };
  const payload = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { valid: false, reason: 'bad_signature' };
  }

  let data: { f?: string; ip?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  if (data.f !== fingerprint(token)) return { valid: false, reason: 'bad_signature' };
  if (!data.exp || data.exp < Date.now()) return { valid: false, reason: 'expired' };
  // An unknown address on either side proves nothing, so it is never a match.
  if (!data.ip || data.ip === 'unknown' || data.ip !== ip) {
    return { valid: false, reason: 'different_network' };
  }

  return { valid: true, expiresAt: data.exp };
}
