"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./session";

/** Clear the session and return to the (dev) login page. */
export async function logout(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
  redirect("/dev-login");
}
