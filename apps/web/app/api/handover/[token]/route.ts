/**
 * The handover checklist for one engagement.
 *
 * GET builds it on first look, from the client's own facts — Companies House
 * for whether anything has ever been filed and what the last accounts were made
 * up to, the engagement for the VAT and PAYE answers. So a client registered a
 * few months ago arrives with its CT600 already marked "not applicable, newly
 * incorporated" rather than sitting open for someone to work out.
 *
 * Staff only. These rows carry client names, periods and free-text notes.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { fetchCompanyFacts } from "@/lib/companies-house-facts";
import { getOrCreateChecklist, readChecklist } from "@/lib/handover-store";
import { CATEGORY_LABELS, SOURCE_LABELS, type ClientFacts } from "@/lib/handover-checklist";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = params.token;
  try {
    const db = getDb();
    const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, token));
    if (!link) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });

    // Already built? Hand it back as it stands — the statuses and notes on it
    // are somebody's work and must never be rebuilt over.
    const existing = await readChecklist(token);
    if (existing.length) {
      return NextResponse.json({
        companyName: link.companyName, companyNumber: link.companyNumber,
        items: existing, categories: CATEGORY_LABELS, sources: SOURCE_LABELS, seeded: false,
      });
    }

    /* FIRST LOOK: gather what we can before asking anyone. */
    const ch = link.companyNumber ? await fetchCompanyFacts(link.companyNumber) : null;
    const services = (link.services ?? []) as Array<{ id?: string; name?: string }>;
    const hasService = (needle: string) =>
      services.some((s) => `${s.id ?? ""} ${s.name ?? ""}`.toLowerCase().includes(needle));

    const acceptance = (link.acceptanceData ?? {}) as Record<string, unknown>;
    const facts: ClientFacts = {
      onboardingDate: link.acceptedAt ? new Date(link.acceptedAt) : new Date(),
      // The engagement tells us what we have been asked to do, which is the
      // best signal available until someone confirms it on the screen.
      vatRegistered: typeof acceptance.vatRegistered === "boolean"
        ? (acceptance.vatRegistered as boolean)
        : hasService("vat") ? true : null,
      payeRegistered: hasService("payroll") || hasService("paye") ? true : null,
      hasFilingHistory: ch?.hasFilingHistory ?? null,
      lastAccountsTo: ch?.lastAccountsTo ?? null,
      lastVatReturnTo: null,
      previousSoftware: (acceptance.previousSoftware as string) ?? null,
    };

    const items = await getOrCreateChecklist(token, facts);
    return NextResponse.json({
      companyName: link.companyName, companyNumber: link.companyNumber,
      companiesHouse: ch
        ? {
            name: ch.name, status: ch.status,
            incorporatedOn: ch.incorporatedOn, hasFilingHistory: ch.hasFilingHistory,
            lastAccountsTo: ch.lastAccountsTo, error: ch.error ?? null,
          }
        : null,
      items, categories: CATEGORY_LABELS, sources: SOURCE_LABELS, seeded: true,
    });
  } catch (e: unknown) {
    console.error("handover checklist failed:", e);
    return NextResponse.json(
      { error: "Could not build the checklist", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
