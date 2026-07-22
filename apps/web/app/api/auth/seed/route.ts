import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createUserWithCredentials, assignRole } from "@gns/db";
import { hashPassword } from "@/lib/auth/passwords";

/**
 * One-time admin bootstrap. Protected: requires ADMIN_PASSWORD to be set in the
 * environment AND passed as ?key= (or JSON body {key}) — so only the operator
 * who configured the deployment can seed. Idempotent: no-op if the admin
 * account already exists.
 */
async function seedAdmin(key: string | null) {
  const email = process.env.ADMIN_EMAIL || "accounts@gnsassociates.co.uk";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return NextResponse.json(
      { message: "Seeding disabled: set ADMIN_PASSWORD in the environment first." },
      { status: 403 },
    );
  }
  if (key !== password) {
    return NextResponse.json({ message: "Invalid seed key." }, { status: 403 });
  }

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

export async function GET(req: NextRequest) {
  return seedAdmin(req.nextUrl.searchParams.get("key"));
}

export async function POST(req: NextRequest) {
  let key: string | null = req.nextUrl.searchParams.get("key");
  if (!key) {
    try {
      const body = await req.json();
      key = body?.key ?? null;
    } catch {
      /* no body */
    }
  }
  return seedAdmin(key);
}
