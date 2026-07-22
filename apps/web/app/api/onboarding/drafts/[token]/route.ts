import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";

export const dynamic = "force-dynamic";

// Load a saved wizard draft so the Services/Company steps can rehydrate on resume.
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const db = getDb();
    const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.token));
    if (!link) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    const meta = (link.letterMeta ?? {}) as {
      wizardDraft?: Record<string, unknown>;
      ch?: Record<string, unknown> | null;
    };
    const draft = meta.wizardDraft ?? {};

    return NextResponse.json({
      token: link.token,
      status: link.status,
      firmSlug: link.firmSlug,
      companyNumber: link.companyNumber,
      companyName: link.companyName,
      directorName: link.directorName,
      directorEmail: link.directorEmail,
      services: link.services ?? [],
      step: draft.step ?? "services",
      prices: draft.prices ?? {},
      selectedOneoff: draft.selectedOneoff ?? [],
      customFees: draft.customFees ?? [],
      scopeRows: draft.scopeRows ?? null,
      partnerName: draft.partnerName ?? null,
      sendMode: draft.sendMode ?? null,
      regBody: draft.regBody ?? null,
      ch: meta.ch ?? null,
      savedAt: draft.savedAt ?? null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error loading onboarding draft:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
