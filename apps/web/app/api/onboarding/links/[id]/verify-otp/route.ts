import { NextRequest, NextResponse } from 'next/server';
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from '@gns/db';
import { createHash } from 'crypto';
import { ENGAGE_SESSION_MINUTES, clientIp, engageCookieName, issueEngageSession } from '@/lib/engage-session';

export const dynamic = 'force-dynamic';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = (await params).id;
  const body = await req.json().catch(() => ({})) as { code?: string };
  const code = body.code?.trim();
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: 'Please enter a 6-digit code' }, { status: 400 });
  }

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

  const meta = (link.letterMeta ?? {}) as Record<string, unknown>;
  const otp = meta.otp as { hash?: string; expiresAt?: string; attempts?: number } | undefined;
  if (!otp?.hash) {
    return NextResponse.json({ error: 'No code has been sent. Please request a new one.' }, { status: 400 });
  }

  if (otp.expiresAt && new Date(otp.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Code has expired. Please request a new one.' }, { status: 400 });
  }

  /* A GUESS LIMIT.
     Sending was capped at 5 codes per 10 minutes, but GUESSES were unlimited —
     and a 6-digit code with a 10-minute life is perfectly guessable at machine
     speed. Five tries, then the code is dead and a new one must be requested,
     which re-applies the send limit. */
  const MAX_ATTEMPTS = 5;
  const attempts = Number(otp.attempts ?? 0);
  if (attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: 'Too many incorrect codes. Please request a new one.' },
      { status: 429 },
    );
  }

  if (hashCode(code) !== otp.hash) {
    // Count the failure before answering, so a parallel flood still runs out.
    await db
      .transaction((tx) =>
        updateOnboardingLink(tx, link.id, {
          letterMeta: { ...meta, otp: { ...otp, attempts: attempts + 1 } },
        }),
      )
      .catch(() => undefined);
    const left = MAX_ATTEMPTS - (attempts + 1);
    return NextResponse.json(
      {
        error: left > 0
          ? `Invalid code. Please check and try again (${left} ${left === 1 ? 'try' : 'tries'} left).`
          : 'Invalid code. Please request a new one.',
      },
      { status: 400 },
    );
  }

  /* Correct code: remember it for 30 minutes on THIS network address, so
     refreshing the page — or coming back from GoCardless — does not send the
     client round the code loop again. See lib/engage-session.ts for why it is
     scoped the way it is. */
  const ip = clientIp(req);
  const session = issueEngageSession(token, ip);
  // A correct code clears the counter, so a later session starts fresh.
  await db.transaction((tx) => updateOnboardingLink(tx, link.id, {
    letterMeta: { ...meta, otp: { ...otp, attempts: 0 } },
  })).catch(() => undefined);
  const res = NextResponse.json({
    verified: true,
    email: link.clientEmail,
    expiresInMinutes: ENGAGE_SESSION_MINUTES,
  });
  res.cookies.set(engageCookieName(token), session.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: session.maxAge,
  });
  return res;
}
