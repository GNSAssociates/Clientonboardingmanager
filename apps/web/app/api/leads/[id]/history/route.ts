/**
 * The full history of one lead: every email with any GNS mailbox, contact
 * logged by hand (WhatsApp, calls, meetings), and every change made on it.
 *
 * GET  ?fresh=1 skips the two-minute mailbox cache (the "Refresh" button).
 * POST logs a WhatsApp message, call, meeting or text.
 * DELETE ?eventId=… removes a contact note logged in error.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLead, updateLead } from "@/lib/lead-store";
import { leadsSession } from "@/lib/leads-auth";
import {
  listLeadEvents, leadEmailHistory, applyEmailFacts, logLeadEvent, deleteContactEvent,
  ensureLeadEventsTable, CONTACT_CHANNELS,
} from "@/lib/lead-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await ensureLeadEventsTable();
    const lead = await getLead(params.id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const fresh = req.nextUrl.searchParams.get("fresh") === "1";
    const [events, mail] = await Promise.all([
      listLeadEvents(lead.id),
      leadEmailHistory(lead.email, { fresh }).catch((e) => {
        console.error("lead email history failed:", e);
        return { emails: [], access: "error" as const, mailboxesSearched: 0, skipped: [], searchedFor: lead.email };
      }),
    ]);
    const { autoContacted } = await applyEmailFacts(lead, mail.emails);

    return NextResponse.json({
      events: autoContacted ? await listLeadEvents(lead.id) : events,
      mail,
      statusChanged: Boolean(autoContacted),
    });
  } catch (e) {
    console.error("lead history failed:", e);
    return NextResponse.json({ error: "could_not_load" }, { status: 500 });
  }
}

const contactSchema = z.object({
  channel: z.enum(CONTACT_CHANNELS),
  direction: z.enum(["in", "out"]),
  /** When it happened; defaults to now. Not in the future. */
  at: z.string().datetime({ offset: true }).optional(),
  text: z.string().trim().min(1).max(5000),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = contactSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Say what was said, and how." }, { status: 400 });
  const b = parsed.data;
  const at = b.at && Date.parse(b.at) <= Date.now() + 60_000 ? new Date(b.at).toISOString() : new Date().toISOString();

  try {
    const lead = await getLead(params.id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logLeadEvent({
      leadId: lead.id, kind: "contact", channel: b.channel, direction: b.direction, at, text: b.text,
      actorId: session.userId, actorName: session.displayName ?? null,
    });
    // Speaking to them counts as contact: a New lead moves on, as it does for an email reply.
    if (b.direction === "out" && lead.status === "new") {
      await updateLead(lead.id, { status: "contacted" }, session.userId);
      await logLeadEvent({ leadId: lead.id, kind: "auto", text: "Moved to Contacted after logged contact." });
    }
    return NextResponse.json({ ok: true, events: await listLeadEvents(lead.id) }, { status: 201 });
  } catch (e) {
    console.error("log contact failed:", e);
    return NextResponse.json({ error: "could_not_save" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const eventId = req.nextUrl.searchParams.get("eventId") ?? "";
  if (!isUuid(params.id) || !isUuid(eventId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await deleteContactEvent(params.id, eventId);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
