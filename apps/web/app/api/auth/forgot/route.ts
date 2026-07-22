import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, setResetToken } from "@gns/db";
import { generateToken } from "@/lib/auth/passwords";
import { sendMail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await setResetToken(user.id, token, expiresAt);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/login?mode=reset&token=${token}`;

    try {
      await sendMail({
        to: user.email,
        subject: "GNS Platform — Password Reset",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <h2 style="color:#272260;margin:0">GNS Associates</h2>
              <p style="color:#7a7296;font-size:14px;margin:4px 0 0">Password Reset</p>
            </div>
            <div style="background:#f8f6ff;border:1px solid #e8e4f0;border-radius:12px;padding:24px">
              <p style="color:#2a2342;font-size:14px;margin:0 0 16px">
                Hi${user.displayName ? ` ${user.displayName}` : ''},
              </p>
              <p style="color:#2a2342;font-size:14px;margin:0 0 16px">
                We received a request to reset your password. Click the button below to choose a new password:
              </p>
              <div style="text-align:center;margin:24px 0">
                <a href="${resetLink}" style="background:linear-gradient(135deg,#6d5be0,#8b5cf6);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
                  Reset Password
                </a>
              </div>
              <p style="color:#7a7296;font-size:13px;margin:0">
                This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          </div>
        `,
        noGlobalCc: true,
      });
    } catch (e) {
      console.error("Failed to send reset email:", e);
    }

    return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
  } catch (e) {
    console.error("Forgot password error:", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
