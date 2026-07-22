"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listAllEntityIds } from "@gns/db";
import type { Role } from "@gns/config";
import { buildDevSession, isDevAuthEnabled } from "@/lib/auth/dev";
import { signSession } from "@/lib/auth/cookie";
import { SESSION_COOKIE } from "@/lib/auth/session";

/** Best-effort: list seeded entity ids so dev staff sessions get entity scope. */
async function seededEntityIds(): Promise<string[]> {
  try {
    return await listAllEntityIds();
  } catch {
    return []; // DB not running locally — Admin still works (bypasses scope)
  }
}

export async function loginAs(formData: FormData): Promise<void> {
  if (!isDevAuthEnabled()) throw new Error("Dev auth is disabled in production.");
  const roles = (formData.get("roles") as string).split(",") as Role[];
  const entityIds = roles.includes("Client") ? [] : await seededEntityIds();
  const session = buildDevSession(roles, entityIds);

  cookies().set(SESSION_COOKIE, signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect(roles.includes("Client") ? "/client" : "/dashboard");
}
