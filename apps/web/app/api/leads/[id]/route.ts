/**
 * One lead: read it in full (GET) or move it along (PATCH).
 *
 * "Take it" sets the owner to whoever pressed it; the name is copied onto the
 * lead so the list can show it without anyone needing staff-admin rights to
 * look names up.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/lead-parse";
import { getLead, updateLead } from "@/lib/lead-store";
import { leadsSession } from "@/lib/leads-auth";
import { FIRMS } from "@/lib/firms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await getLead(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

const str = (max: number) => z.string().max(max).nullable().optional();

const patchSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  notes: str(5000),
  nextActionOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lostReason: str(500),
  /** true = "I'll take it", false = release it. */
  takeOwnership: z.boolean().optional(),
  firmSlug: z.string().nullable().optional(),
  intakeToken: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
  name: str(200),
  email: str(200),
  phone: str(50),
  companyName: str(300),
  companyNumber: str(20),
  services: str(1000),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await leadsSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", details: parsed.error.format() }, { status: 400 });
  }
  const { takeOwnership, firmSlug, ...rest } = parsed.data;

  try {
    await updateLead(
      params.id,
      {
        ...rest,
        ...(firmSlug !== undefined ? { firmSlug: firmSlug && firmSlug in FIRMS ? firmSlug : null } : {}),
        ...(takeOwnership === true ? { ownerId: session.userId, ownerName: session.displayName ?? "Staff member" } : {}),
        ...(takeOwnership === false ? { ownerId: null, ownerName: null } : {}),
      },
      session.userId,
    );
    const lead = await getLead(params.id);
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    console.error("lead update failed:", e);
    return NextResponse.json({ error: "could_not_save" }, { status: 500 });
  }
}
