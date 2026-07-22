import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import {
  verify2FACode,
  increment2FAAttempts,
  getUserRoles,
  getUserEntityIds,
  createAuthSession,
  findUserByEmail,
} from "@gns/db";
import { generateToken } from "@/lib/auth/passwords";
import { signSession } from "@/lib/auth/cookie";
import { SESSION_COOKIE } from "@/lib/auth/session";
import type { AuthSession } from "@gns/core";
import { getDb } from "@gns/db";
import { users } from "@gns/db/tables";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId, code, remember } = await req.json();
    if (!userId || !code) {
      return NextResponse.json({ message: "User ID and code are required." }, { status: 400 });
    }

    const valid = await verify2FACode(userId, code);
    if (!valid) {
      await increment2FAAttempts(userId);
      return NextResponse.json({ message: "Invalid or expired verification code." }, { status: 401 });
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const userRoles = await getUserRoles(userId);
    const entityIds = await getUserEntityIds(userId);

    const session: AuthSession = {
      userId: user.id,
      displayName: user.displayName ?? user.email,
      roles: userRoles as any[],
      entityIds,
      isAdmin: userRoles.includes("Admin"),
    };

    const token = generateToken();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const maxAge = remember ? 20 * 24 * 60 * 60 : 24 * 60 * 60;
    await createAuthSession({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + maxAge * 1000),
      rememberMe: !!remember,
    });

    cookies().set(SESSION_COOKIE, signSession(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    });

    return NextResponse.json({ ok: true, redirect: "/dashboard" });
  } catch (e) {
    console.error("2FA verify error:", e);
    return NextResponse.json({ message: "Verification failed." }, { status: 500 });
  }
}
