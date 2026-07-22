import { NextRequest, NextResponse } from "next/server";
import { findUserByResetToken, clearResetToken, updatePasswordHash, deleteUserSessions } from "@gns/db";
import { hashPassword } from "@/lib/auth/passwords";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ message: "Token and password are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: "Password must be at least 6 characters." }, { status: 400 });
    }

    const record = await findUserByResetToken(token);
    if (!record) {
      return NextResponse.json({ message: "Invalid or expired reset link." }, { status: 400 });
    }
    if (record.resetTokenExpiresAt && record.resetTokenExpiresAt < new Date()) {
      return NextResponse.json({ message: "This reset link has expired." }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    await updatePasswordHash(record.userId, passwordHash);
    await clearResetToken(record.userId);
    await deleteUserSessions(record.userId);

    return NextResponse.json({ ok: true, message: "Password updated successfully." });
  } catch (e) {
    console.error("Reset password error:", e);
    return NextResponse.json({ message: "Could not reset the password." }, { status: 500 });
  }
}
