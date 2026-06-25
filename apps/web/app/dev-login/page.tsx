import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEV_PRESETS, isDevAuthEnabled } from "@/lib/auth/dev";
import { loginAs } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Dev login (M1). Pick a role to get a signed-cookie session. Disabled in
 * production — the real Entra/Supabase sign-in replaces this page.
 */
export default function DevLoginPage() {
  if (!isDevAuthEnabled()) notFound();

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="text-sm font-medium text-accent">GNS Associates · Development</p>
      <h1 className="mt-2 text-2xl font-semibold">Sign in (dev shim)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose a role. This issues a signed session cookie with the same shape the production Entra
        (staff) / Supabase (client) providers will produce.
      </p>

      <div className="mt-8 space-y-2">
        {DEV_PRESETS.map((preset) => (
          <form key={preset.label} action={loginAs}>
            <input type="hidden" name="roles" value={preset.roles.join(",")} />
            <Button type="submit" variant="outline" className="w-full justify-between">
              <span>{preset.label}</span>
              <span className="text-xs text-muted-foreground">{preset.roles.join(", ")}</span>
            </Button>
          </form>
        ))}
      </div>
    </main>
  );
}
