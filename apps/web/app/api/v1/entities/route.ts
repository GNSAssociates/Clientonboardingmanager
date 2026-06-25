import { NextResponse, type NextRequest } from "next/server";
import { createEntity, createEntitySchema, listEntitiesForSession } from "@gns/core";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/v1/entities — list entities the session may access (A4 §5.1). */
export async function GET() {
  const session = getSession();
  if (!session) return unauthorized();
  try {
    const data = await listEntitiesForSession(session);
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

/** POST /api/v1/entities — create an entity (Admin/Partner; configure_entities). */
export async function POST(request: NextRequest) {
  const session = getSession();
  if (!session) return unauthorized();
  try {
    const input = createEntitySchema.parse(await request.json());
    const data = await createEntity(session, input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
