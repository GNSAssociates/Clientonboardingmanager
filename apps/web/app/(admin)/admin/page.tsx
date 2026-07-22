import { can, listEntitiesForSession, type AuthSession } from "@gns/core";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { createEntityAction } from "./actions";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border px-3 py-2 text-sm";

export default async function AdminEntitiesPage() {
  const session: AuthSession = requireSession();
  if (!can(session, "configure_entities")) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Entities</h1>
        <p className="mt-2 text-sm text-amber-600">
          You don&apos;t have permission to configure entities (need Admin or Partner).
        </p>
      </div>
    );
  }

  let rows: Awaited<ReturnType<typeof listEntitiesForSession>> = [];
  let dbError = false;
  try {
    rows = await listEntitiesForSession(session);
  } catch {
    dbError = true;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Entities</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        White-label practice entities (BR-ENT-*). Each carries its own branding, bank, signatory and
        AML supervisor.
      </p>

      {dbError ? (
        <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Database not reachable. Start it (<code>supabase start</code>), apply migrations
          (<code>pnpm db:migrate</code>) and seed (<code>pnpm --filter @gns/db seed</code>).
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded-md border">
          {rows.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              No entities yet — create one below or run the seed.
            </li>
          )}
          {rows.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-medium">{e.code}</span>
                <span className="ml-2 text-sm text-muted-foreground">{e.legalName}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {(e.amlSupervisor as { body?: string } | null)?.body ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={createEntityAction} className="mt-8 rounded-lg border p-5">
        <h2 className="font-medium">Add entity</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="text-sm">
            Code
            <input name="code" required className={field} placeholder="GNS" />
          </label>
          <label className="text-sm">
            Legal name
            <input name="legalName" required className={field} placeholder="GNS Associates Limited" />
          </label>
          <label className="text-sm">
            Trading name
            <input name="tradingName" className={field} placeholder="GNS Associates" />
          </label>
          <label className="text-sm">
            Address line 1
            <input name="addressLine1" required className={field} />
          </label>
          <label className="text-sm">
            City
            <input name="city" required className={field} />
          </label>
          <label className="text-sm">
            Postcode
            <input name="postcode" required className={field} />
          </label>
          <label className="text-sm">
            Signatory name
            <input name="signatoryName" required className={field} />
          </label>
          <label className="text-sm">
            Signatory role
            <input name="signatoryRole" required className={field} placeholder="Director" />
          </label>
          <label className="text-sm">
            AML supervisor
            <input name="amlBody" required className={field} placeholder="ICAEW" />
          </label>
          <label className="text-sm">
            AML registration no.
            <input name="amlReg" required className={field} />
          </label>
        </div>
        <Button type="submit" className="mt-5">
          Create entity
        </Button>
      </form>
    </div>
  );
}
