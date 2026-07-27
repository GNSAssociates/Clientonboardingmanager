import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveModuleAccess } from "@/lib/auth/module-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  // Effective module access (Partner panel + static fallback) so the dashboard
  // shows exactly the modules this user may open.
  const access = await resolveModuleAccess(session);
  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    displayName: session.displayName,
    roles: session.roles,
    isAdmin: session.isAdmin,
    canManagePermissions: session.isAdmin || session.roles.includes("Partner"),
    access,
  });
}
