import { NextRequest, NextResponse } from 'next/server';
import { getDb, getOnboardingLinkByToken, updateOnboardingLink } from '@gns/db';
import { createHash, randomInt } from 'crypto';
import { sendTemplatedMail } from '@/lib/send-templated-mail';

export const dynamic = 'force-dynamic';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = (await params).id;
  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

  const meta = (link.letterMeta ?? {}) as Record<string, unknown>;
  const otp = meta.otp as { sentCount?: number; lastSentAt?: string } | undefined;

  // Rate limit: max 5 sends per 10 minutes
  if (otp?.sentCount && otp.sentCount >= 5 && otp.lastSentAt) {
    const elapsed = Date.now() - new Date(otp.lastSentAt).getTime();
    if (elapsed < 10 * 60 * 1000) {
      return NextResponse.json({ error: 'Too many codes sent. Please wait a few minutes.' }, { status: 429 });
    }
  }

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db.transaction((tx) => updateOnboardingLink(tx, link.id, {
    letterMeta: {
      ...meta,
      otp: {
        hash: hashCode(code),
        expiresAt,
        sentCount: ((otp?.sentCount ?? 0) + 1),
        lastSentAt: new Date().toISOString(),
      },
    },
  }));

  await sendTemplatedMail({
    key: 'client_otp',
    firm: link.firmSlug || 'gns',
    to: link.clientEmail,
    toName: link.directorName || undefined,
    vars: {
      code,
      companyName: link.companyName || 'your company',
    },
    noGlobalCc: true,
    token,
  });

  return NextResponse.json({ sent: true, email: link.clientEmail.replace(/(.{2}).*(@.*)/, '$1***$2') });
}
