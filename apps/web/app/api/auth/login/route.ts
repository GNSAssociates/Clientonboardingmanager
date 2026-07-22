import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import {
  findUserWithCredentials,
  getUserRoles,
  getUserEntityIds,
  createAuthSession,
  create2FACode,
} from "@gns/db";
import { verifyPassword, generateToken, generate2FACode } from "@/lib/auth/passwords";
import { signSession } from "@/lib/auth/cookie";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { sendMail } from "@/lib/mailer";
import type { AuthSession } from "@gns/core";

export async function POST(req: NextRequest) {
  try {
    const { email, password, remember } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    const user = await findUserWithCredentials(email);
    if (!user || !user.passwordHash) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }
    if (user.status === "disabled") {
      return NextResponse.json({ message: "Your account has been disabled." }, { status: 403 });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    const userRoles = await getUserRoles(user.id);
    const entityIds = await getUserEntityIds(user.id);

    if (user.twoFactorEnabled) {
      const code = generate2FACode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await create2FACode(user.id, code, expiresAt);

      try {
        await sendMail({
          to: user.email,
          subject: "GNS Platform — Your verification code",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <div style="text-align:center;margin-bottom:24px">
                <h2 style="color:#272260;margin:0">GNS Associates</h2>
                <p style="color:#7a7296;font-size:14px;margin:4px 0 0">Verification Code</p>
              </div>
              <div style="background:#f8f6ff;border:1px solid #e8e4f0;border-radius:12px;padding:24px;text-align:center">
                <p style="color:#2a2342;font-size:14px;margin:0 0 16px">Your one-time verification code is:</p>
                <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#6d5be0;margin:8px 0">${code}</div>
                <p style="color:#7a7296;font-size:13px;margin:16px 0 0">This code expires in 10 minutes.</p>
              </div>
              <p style="color:#999;font-size:12px;text-align:center;margin-top:24px">
                If you did not request this code, please ignore this email.
              </p>
            </div>
          `,
          noGlobalCc: true,
        });
      } catch (e) {
        console.error("Failed to send 2FA email:", e);
      }

      return NextResponse.json({
        requires2FA: true,
        userId: user.id,
        message: "Verification code sent to your email.",
      });
    }

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
    console.error("Login error:", e);
    return NextResponse.json({ message: "An error occurred during sign-in." }, { status: 500 });
  }
}
