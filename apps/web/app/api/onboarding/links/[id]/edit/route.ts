import { NextRequest, NextResponse } from "next/server";
import { getDb, getOnboardingLinkByToken } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { engagementEditState, editRefusalMessage } from "@/lib/engagement-edit-gate";
import type { LetterService } from "@/lib/letter-html";

export const dynamic = "force-dynamic";

/**
 * A sent engagement, reshaped into the form the wizard works in, so staff can
 * reopen and re-price it rather than re-keying it into a new engagement.
 *
 * Staff only, and a separate endpoint from the draft loader on purpose. That
 * one is unauthenticated because a draft token is never given to anybody; a
 * SENT token is in the client's inbox, so serving this shape from there would
 * have handed a client their own pricing workings on a URL they already hold.
 *
 * The wizard draft blob does not survive sending — the create route writes a
 * fresh letterMeta — so the wizard state is reconstructed from the engagement
 * itself: the service rows carry id, price, frequency and Companies House fee,
 * and letterMeta carries everything else.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const link = await db.transaction((tx) => getOnboardingLinkByToken(tx, params.id));
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const gate = engagementEditState(link);
  if (!gate.editable) {
    return NextResponse.json({ error: editRefusalMessage(gate), blockers: gate.blockers }, { status: 409 });
  }

  const m = (link.letterMeta ?? {}) as Record<string, unknown>;
  const services = (link.services ?? []) as LetterService[];

  // Rebuild the per-service maps the wizard drives its fee table from.
  const selected: string[] = [];
  const selectedOneoff: string[] = [];
  const prices: Record<string, number> = {};
  const frequencies: Record<string, string> = {};
  const chFees: Record<string, number> = {};
  for (const s of services) {
    if (!s.id) continue; // a hand-added line with no id belongs in customFees
    (s.oneoff ? selectedOneoff : selected).push(s.id);
    prices[s.id] = s.price ?? 0;
    if (s.frequency) frequencies[s.id] = s.frequency;
    if (typeof s.chFee === "number") chFees[s.id] = s.chFee;
  }

  return NextResponse.json({
    token: link.token,
    status: link.status,
    editState: gate,
    firmSlug: link.firmSlug,
    companyNumber: link.companyNumber,
    companyName: link.companyName,
    directorName: link.directorName,
    directorEmail: link.directorEmail ?? link.clientEmail,
    services,
    selected,
    selectedOneoff,
    prices,
    frequencies,
    chFees,
    customFees: m.customFees ?? [],
    scopeRows: m.scopeRows ?? null,
    softwareItems: m.softwareItems ?? [],
    partnerName: m.partnerName ?? null,
    regBody: m.regBody ?? null,
    sendMode: m.sendMode ?? null,
    paymentMethod: m.paymentMethod ?? "dd",
    includeAnnexA: m.includeAnnexA !== false,
    includeClearance: m.includeClearance !== false,
    includeDdClause: m.includeDdClause === true,
    ddClauseNote: m.ddClauseNote ?? "",
    clientType: m.clientType ?? "limited",
    clientName: m.clientName ?? null,
    businessAddress: m.clientAddress ?? null,
    utr: m.utr ?? null,
    ch: m.ch ?? null,
    specialTerms: m.specialTerms ?? "",
    /* 64-8 is deliberately read-only here. It is fixed when the engagement is
       created and the PATCH route refuses to change it, so the wizard shows
       what was issued rather than offering an edit that cannot be saved. */
    include648: m.include648 === true,
    taxes648: m.taxes648 ?? null,
  });
}
