import { NextRequest, NextResponse } from "next/server";
import { getDb, getClearanceRequestById, updateClearanceRequest } from "@gns/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const request = await db.transaction((tx) => getClearanceRequestById(tx, params.id));
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(request);
}

// Staff edits: previous accountant email/name, status/outcome overrides
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    prevFirmName?: string;
    prevFirmEmail?: string;
    status?: "draft" | "sent" | "chased" | "received" | "declined" | "not_required" | "timed_out";
    outcome?: "clear" | "issues_raised" | "no_response" | "refused" | null;
    notes?: string;
    stopChase?: boolean; // pause/resume the auto-chase for this previous accountant
  };

  const db = getDb();
  const request = await db.transaction((tx) => getClearanceRequestById(tx, params.id));
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rd = (request.responseData as Record<string, unknown>) ?? {};
  const rdUpdates: Record<string, unknown> = {};
  if (body.notes !== undefined) rdUpdates.staffNotes = body.notes;
  if (body.stopChase !== undefined) rdUpdates.stopChase = body.stopChase;

  const updated = await db.transaction((tx) =>
    updateClearanceRequest(tx, params.id, {
      ...(body.prevFirmName !== undefined ? { prevFirmName: body.prevFirmName } : {}),
      ...(body.prevFirmEmail !== undefined ? { prevFirmEmail: body.prevFirmEmail } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.outcome !== undefined ? { outcome: body.outcome } : {}),
      ...(Object.keys(rdUpdates).length ? { responseData: { ...rd, ...rdUpdates } } : {}),
    })
  );

  return NextResponse.json(updated);
}
