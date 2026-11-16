/**
 * Draft a reply to a lead.
 *
 *   POST { save: false }  → check the quote and show the draft (nothing saved)
 *   POST { save: true }   → also put it in your Outlook Drafts
 *
 * Nothing is ever sent from here.
 */
import { NextRequest, NextResponse } from "next/server";
import { getLead } from "@/lib/lead-store";
import { leadsSession } from "@/lib/leads-auth";
import { logLeadEvent } from "@/lib/lead-history";
import { composeDraft, draftMailboxFor, saveOutlookDraft } from "@/lib/lead-draft";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { save?: boolean };
  try {
    const lead = await getLead(params.id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const draft = composeDraft(lead, session.displayName ?? null);
    const mailbox = await draftMailboxFor(session.userId);
    const mailto = lead.email
      ? `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.text).slice(0, 1800)}`
      : null;

    if (!body.save) return NextResponse.json({ draft, mailbox, mailto });
    if (!lead.email) return NextResponse.json({ error: "This lead has no email address to reply to." }, { status: 400 });

    const saved = await saveOutlookDraft(mailbox, { email: lead.email, name: lead.name }, draft);
    if (saved.saved) {
      await logLeadEvent({
        leadId: lead.id, kind: "draft", actorId: session.userId, actorName: session.displayName ?? null,
        text: `Draft reply "${draft.subject}" saved in ${mailbox} (Outlook Drafts, not sent).`,
      }).catch(() => {});
    }
    return NextResponse.json({ draft, mailbox, mailto, saved });
  } catch (e) {
    console.error("draft reply failed:", e);
    return NextResponse.json({ error: "could_not_draft" }, { status: 500 });
  }
}
