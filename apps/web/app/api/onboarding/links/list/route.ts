import { NextResponse } from "next/server";
import { getDb, listAllLinks } from "@gns/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Staff-only: all onboarding links with prev accountant + letter/signing state.
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const links = await db.transaction((tx) => listAllLinks(tx));

  return NextResponse.json(links.map((l) => {
    const acc = (l.acceptanceData ?? {}) as Record<string, unknown>;
    const meta = (l.letterMeta ?? {}) as Record<string, unknown>;
    return {
      id: l.id,
      token: l.token,
      companyName: l.companyName,
      companyNumber: l.companyNumber,
      directorName: l.directorName,
      clientEmail: l.clientEmail,
      firmSlug: l.firmSlug,
      status: l.status,
      sentAt: l.sentAt,
      acceptedAt: l.acceptedAt,
      expiresAt: l.expiresAt,
      updatedAt: l.updatedAt,
      draftStep: ((meta.wizardDraft as Record<string, unknown> | undefined)?.step as string) ?? null,
      sendMode: (meta.sendMode as string) ?? "engagement",
      partnerName: (meta.partnerName as string) ?? null,
      hasLetter: Boolean(l.letterHtml),
      hasSignedLetter: Boolean(l.signedHtml),
      signatureName: (acc.signatureName as string) ?? null,
      prevAccountantFirmName: l.prevAccountantFirmName,
      prevAccountantEmail: l.prevAccountantEmail,
      prevAccountantPhone: (acc.prevPhone as string) ?? null,
      services: l.services ?? [],
    };
  }));
}
