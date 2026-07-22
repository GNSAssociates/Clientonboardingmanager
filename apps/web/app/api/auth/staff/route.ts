import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@gns/core";
import {
  listAllStaff,
  createUserWithCredentials,
  assignRole,
  removeUserRoles,
  updateUserStatus,
  deleteUser,
  updatePasswordHash,
  deleteUserSessions,
} from "@gns/db";
import { hashPassword } from "@/lib/auth/passwords";

export async function GET() {
  const session = getSession();
  if (!session || !can(session, "manage_staff")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const staff = await listAllStaff();
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !can(session, "manage_staff")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { email, displayName, password, roles: roleNames } = await req.json();
    if (!email || !password || !displayName) {
      return NextResponse.json({ message: "Email, name and password are required." }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    const user = await createUserWithCredentials({ email, displayName, passwordHash });

    if (roleNames?.length) {
      for (const roleName of roleNames) {
        await assignRole(user.id, roleName);
      }
    }

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.message?.includes("unique") || e?.code === "23505") {
      return NextResponse.json({ message: "A user with that email already exists." }, { status: 409 });
    }
    console.error("Create staff error:", e);
    return NextResponse.json({ message: "Failed to create staff member." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = getSession();
  if (!session || !can(session, "manage_staff")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { userId, roles: roleNames, status, password } = await req.json();
    if (!userId) {
      return NextResponse.json({ message: "userId is required." }, { status: 400 });
    }

    if (roleNames) {
      await removeUserRoles(userId);
      for (const roleName of roleNames) {
        await assignRole(userId, roleName);
      }
    }

    if (status) {
      await updateUserStatus(userId, status);
      if (status === "disabled") await deleteUserSessions(userId);
    }

    if (password) {
      await updatePasswordHash(userId, hashPassword(password));
      await deleteUserSessions(userId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Update staff error:", e);
    return NextResponse.json({ message: "Failed to update staff member." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = getSession();
  if (!session || !can(session, "manage_staff")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ message: "userId is required." }, { status: 400 });
    }
    if (userId === session.userId) {
      return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 });
    }
    await deleteUser(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete staff error:", e);
    return NextResponse.json({ message: "Failed to delete staff member." }, { status: 500 });
  }
}
