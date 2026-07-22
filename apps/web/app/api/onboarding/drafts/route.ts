import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb, upsertDraftLink } from "@gns/db";

export const dynamic = "force-dynamic";

// Autosave the in-progress onboarding wizard. Upserts a draft onboarding_links
// row keyed by token so staff can close the tab mid-flow (e.g. in the fee
// section) and resume later — with progress visible in the dashboard.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      token: incomingToken,
      firmSlug,
      step,
      companyNumber,
      companyName,
      directorName,
      directorEmail,
      services,
      prices,
      selectedOneoff,
      customFees,
      scopeRows,
      partnerName,
      sendMode,
      regBody,
      ch,
    } = body as {
      token?: string;
      firmSlug?: string;
      step?: string;
      companyNumber?: string;
      companyName?: string;
      directorName?: string;
      directorEmail?: string;
      services?: Array<{ id: string; name: string; price: number }>;
      prices?: Record<string, number>;
      selectedOneoff?: string[];
      customFees?: Array<{ description: string; price: number }>;
      scopeRows?: Array<{ service: string; threshold: string; excess: string }>;
      partnerName?: string;
      sendMode?: string;
      regBody?: string;
      ch?: Record<string, unknown> | null;
    };

    if (!firmSlug) {
      return NextResponse.json({ error: "firmSlug is required" }, { status: 400 });
    }

    const token = incomingToken && incomingToken.length >= 16 ? incomingToken : randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const db = getDb();
    const row = await db.transaction((tx) =>
      upsertDraftLink(tx, {
        token,
        firmSlug,
        companyNumber: companyNumber || null,
        companyName: companyName || null,
        directorName: directorName || null,
        directorEmail: directorEmail || null,
        // clientEmail is NOT NULL; use the director email while known, else empty
        clientEmail: directorEmail || "",
        services: services ?? [],
        sentAt: now,
        expiresAt,
        letterMeta: {
          wizardDraft: {
            step: step ?? "services",
            prices: prices ?? {},
            selectedOneoff: selectedOneoff ?? [],
            customFees: customFees ?? [],
            scopeRows: scopeRows ?? null,
            partnerName: partnerName ?? null,
            sendMode: sendMode ?? null,
            regBody: regBody ?? null,
            savedAt: now.toISOString(),
          },
          ch: ch ?? null,
        },
      })
    );

    return NextResponse.json({ success: true, token: row.token, savedAt: now.toISOString() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error saving onboarding draft:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
