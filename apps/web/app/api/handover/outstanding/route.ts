/**
 * Everything still outstanding across every handover — the work list.
 *
 * Grouped by client, because that is how it is chased: one conversation with a
 * previous accountant covers all six things they are holding, not six separate
 * chases. The source is carried through so the screen can say who to ask.
 *
 * Staff only.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { outstandingAcrossClients } from "@/lib/handover-store";
import { SOURCE_LABELS } from "@/lib/handover-checklist";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await outstandingAcrossClients(300);

    const byClient = new Map<string, {
      linkToken: string;
      companyName: string | null;
      total: number;
      fromPreviousAccountant: number;
      fromClient: number;
      /** The two or three worth naming on a summary line. */
      examples: Array<{ label: string; source: string | null; periodTo: string | null; note: string | null }>;
    }>();

    for (const r of rows) {
      const entry = byClient.get(r.linkToken) ?? {
        linkToken: r.linkToken, companyName: r.companyName,
        total: 0, fromPreviousAccountant: 0, fromClient: 0, examples: [],
      };
      entry.total++;
      if (r.source === "previous_accountant") entry.fromPreviousAccountant++;
      if (r.source === "client") entry.fromClient++;
      if (entry.examples.length < 3) {
        entry.examples.push({ label: r.label, source: r.source, periodTo: r.periodTo, note: r.note });
      }
      byClient.set(r.linkToken, entry);
    }

    const clients = [...byClient.values()].sort((a, b) => b.total - a.total);
    return NextResponse.json({
      totalOutstanding: rows.length,
      clients,
      sources: SOURCE_LABELS,
    });
  } catch (e: unknown) {
    console.error("outstanding handover items failed:", e);
    return NextResponse.json({ error: "could_not_load" }, { status: 500 });
  }
}
