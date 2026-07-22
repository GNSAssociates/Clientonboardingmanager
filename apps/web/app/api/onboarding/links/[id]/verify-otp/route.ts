import { NextRequest, NextResponse } from 'next/server';
import { getDb, getOnboardingLinkByToken } from '@gns/db';
import { createHash } from 'crypto';

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
  const otp = meta.otp as { hash?: string; expiresAt?: string } | undefined;
  if (!otp?.hash) {
    return NextResponse.json({ error: 'No code has been sent. Please request a new one.' }, { status: 400 });
  }

  if (otp.expiresAt && new Date(otp.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Code has expired. Please request a new one.' }, { status: 400 });
  }

  if (hashCode(code) !== otp.hash) {
    return NextResponse.json({ error: 'Invalid code. Please check and try again.' }, { status: 400 });
  }

  return NextResponse.json({ verified: true });
}
