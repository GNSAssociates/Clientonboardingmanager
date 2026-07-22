import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { getFirm } from "@/lib/firms";
import { sendTemplatedMail } from "@/lib/send-templated-mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Manually send any template (built-in or a staff-created custom one) to this
 * client, right now. Used for ad-hoc sends that don't fit the automatic flows
 * — e.g. a bespoke clearance letter for an unusual case. Recipient defaults to
 * the client's director; a custom recipient (e.g. their previous accountant)
 * can be supplied instead.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { key?: string; to?: string; toName?: string };
  if (!body.key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const firm = getFirm(link.firmSlug || "gns");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const to = body.to?.trim() || link.clientEmail;
  const toName = body.toName?.trim() || link.directorName || undefined;

  const result = await sendTemplatedMail({
    key: body.key,
    firm,
    token: link.token,
    to,
    toName,
    replyTo: firm.email,
    actionUrl: `${appUrl}/onboarding/engage/${link.token}`,
    vars: {
      directorName: link.directorName ?? "Director",
      companyName: link.companyName ?? "",
      companyNumber: link.companyNumber ?? "",
      prevFirmName: link.prevAccountantFirmName ?? "",
      expiresAt: new Date(link.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      today,
    },
  });

  if (!result.ok) return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 502 });
  return NextResponse.json({ success: true, provider: result.provider });
}
