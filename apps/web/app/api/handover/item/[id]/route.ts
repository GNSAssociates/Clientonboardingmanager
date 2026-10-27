/**
 * One checklist item: its status, its note, and who is responsible for it.
 *
 * The note is the part that was missing and is asked for most: "P11D part
 * pending — NI figures missing for two employees" is the difference between a
 * line somebody can act on and one they have to ask a partner about.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { updateItem } from "@/lib/handover-store";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["pending", "received", "verified", "na"]).optional(),
  note: z.string().max(2000).nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  partnerId: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", details: parsed.error.format() }, { status: 400 });
  }

  try {
    await updateItem(params.id, parsed.data, session.userId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("checklist item update failed:", e);
    return NextResponse.json({ error: "could_not_save" }, { status: 500 });
  }
}
