import { NextResponse } from "next/server";
import { findUserByEmail, createUserWithCredentials, assignRole } from "@gns/db";
import { hashPassword } from "@/lib/auth/passwords";

export async function POST() {
  const email = process.env.ADMIN_EMAIL || "accounts@gnsassociates.co.uk";
  const password = process.env.ADMIN_PASSWORD || "changeme";

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ message: "Admin account already exists.", email });
    }

    const passwordHash = hashPassword(password);
    const user = await createUserWithCredentials({
      email,
      displayName: "GNS Admin",
      passwordHash,
    });

    await assignRole(user.id, "Admin");
    await assignRole(user.id, "Partner");

    return NextResponse.json({ ok: true, message: "Admin account created.", email });
  } catch (e) {
    console.error("Seed error:", e);
    return NextResponse.json({ message: "Failed to seed admin account." }, { status: 500 });
  }
}
