import { NextRequest, NextResponse } from "next/server";
import { can } from "@gns/core";
import { getModuleAccessMap, upsertModuleAccess } from "@gns/db";
import { getSession } from "@/lib/auth/session";
import { STAFF_ROLES, LOCKED_ROLES, staticRoleAccess } from "@/lib/auth/module-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Partner permissions panel API.
 *   GET → the current module-access matrix for every staff role.
 *   PUT → save the matrix (Partner only). Admin & Partner rows are ignored
 *          (always full access), so a Partner can never lock themselves out.
 */
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(session.isAdmin || can(session, "manage_permissions"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let map: Record<string, { onboarding: boolean; invoice: boolean }> = {};
  try {
    map = await getModuleAccessMap();
  } catch {
    map = {};
  }

  const roles = STAFF_ROLES.map((role) => {
    const fallback = staticRoleAccess(role);
    const locked = LOCKED_ROLES.includes(role);
    const current = map[role] ?? fallback;
    return {
      role,
      onboarding: locked ? true : current.onboarding,
      invoice: locked ? true : current.invoice,
      locked,
    };
  });

  return NextResponse.json({ roles });
}

export async function PUT(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Same gate as GET: Admin or Partner. (Admin could previously VIEW the panel
  // but not save — inconsistent, and the firm's admin account runs the demo.)
  if (!(session.isAdmin || can(session, "manage_permissions"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    roles?: Array<{ role: string; onboarding: boolean; invoice: boolean }>;
  };

  const entries = (body.roles ?? [])
    .filter(
      (e) =>
        e &&
        STAFF_ROLES.includes(e.role) &&
        !LOCKED_ROLES.includes(e.role), // never write Admin/Partner — always full
    )
    .map((e) => ({
      role: e.role,
      onboarding: !!e.onboarding,
      invoice: !!e.invoice,
    }));

  try {
    await upsertModuleAccess(entries);
  } catch (e) {
    console.error("permissions PUT failed:", e);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: entries.length });
}
