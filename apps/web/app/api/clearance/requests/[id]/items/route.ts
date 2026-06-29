import { NextRequest, NextResponse } from "next/server";
import { getDb, getClearanceRequestById, updateClearanceRequest } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import type { DocItem } from "@/app/(staff)/staff/cases/[id]/clearance/_tracker";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId, status, receivedDate, notes } = await req.json() as {
    itemId: string;
    status: "pending" | "received" | "na";
    receivedDate: string | null;
    notes: string;
  };

  const db = getDb();
  const request = await db.transaction(tx => getClearanceRequestById(tx, params.id));
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rd = (request.responseData ?? {}) as { docItems?: DocItem[] };
  const items: DocItem[] = rd.docItems ?? [];

  const updated = items.map(item =>
    item.id === itemId
      ? { ...item, status, receivedDate: receivedDate ?? null, notes }
      : item
  );

  const allReceived = updated.every(i => i.status === "received" || i.status === "na");

  await db.transaction(tx =>
    updateClearanceRequest(tx, params.id, {
      responseData: { docItems: updated },
      ...(allReceived ? { status: "received", receivedAt: new Date(), outcome: "clear" } : {}),
    })
  );

  return NextResponse.json({ success: true, allReceived });
}
