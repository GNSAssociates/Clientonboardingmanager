import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * The app opens straight onto the sign-in experience: anonymous visitors get
 * the lamp login page; an already-signed-in user goes to their dashboard.
 */
export default function Home() {
  redirect(getSession() ? "/dashboard" : "/login");
}
