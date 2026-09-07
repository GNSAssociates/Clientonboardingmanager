/**
 * "Has this client already passed the 2FA code on this link, from this network,
 * in the last 30 minutes?"
 *
 * The engage page asks this once on load so a refresh — or the trip out to
 * GoCardless and back — does not throw the client at the code screen again.
 * Returns booleans and an expiry only: the cookie is httpOnly and nothing in
 * this response would help anyone who did not already hold it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb, getOnboardingLinkByToken } from '@gns/db';
import { clientIp, engageCookieName, readEngageSession } from '@/lib/engage-session';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = params.id;
  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const raw = req.cookies.get(engageCookieName(token))?.value;
  const session = readEngageSession(raw, token, clientIp(req));

  return NextResponse.json({
    verified: session.valid,
    reason: session.reason ?? null,
    expiresAt: session.expiresAt ?? null,
    // Only ever returned to someone who already proved they hold the mailbox —
    // it is the address the signature must be submitted with.
    email: session.valid ? link.clientEmail : null,
  });
}
