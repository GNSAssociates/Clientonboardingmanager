import Link from "next/link";
import type { AuthSession } from "@gns/core";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

/** Top bar showing the current session + logout (M1). */
export function SessionBar({ session }: { session: AuthSession | null }) {
  return (
    <div className="flex items-center justify-between border-b px-8 py-3">
      {session ? (
        <span className="text-sm text-muted-foreground">
          {session.displayName} · <span className="font-medium">{session.roles.join(", ")}</span>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Not signed in</span>
      )}
      {session ? (
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      ) : (
        <Link href="/dev-login">
          <Button variant="outline" size="sm">
            Sign in
          </Button>
        </Link>
      )}
    </div>
  );
}
