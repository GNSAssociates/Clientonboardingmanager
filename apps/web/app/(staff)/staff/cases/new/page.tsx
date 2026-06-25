import { can, listAccessibleEntities } from "@gns/core";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { createLeadAction } from "../actions";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border px-3 py-2 text-sm";

/** New client / lead intake form (FR-LEAD-1). */
export default async function NewLeadPage() {
  const session = requireSession();
  if (!can(session, "create_case")) {
    return <p className="text-sm text-amber-600">You can&apos;t create clients.</p>;
  }

  let entities: Awaited<ReturnType<typeof listAccessibleEntities>> = [];
  let dbError = false;
  try {
    entities = await listAccessibleEntities(session);
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
        Database not reachable — start it and run migrations + seed to create clients.
      </p>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">New client</h1>
      <form action={createLeadAction} className="mt-6 space-y-4 rounded-lg border p-5">
        <label className="block text-sm">
          Entity
          <select name="entityId" required className={field}>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} — {e.legalName}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            Client type
            <select name="type" required className={field}>
              <option value="limited">Limited company</option>
              <option value="sole_trader">Sole trader</option>
              <option value="partnership">Partnership</option>
              <option value="llp">LLP</option>
              <option value="individual">Individual</option>
            </select>
          </label>
          <label className="text-sm">
            Company number
            <input name="companyNumber" className={field} placeholder="01234567" />
          </label>
        </div>
        <label className="block text-sm">
          Client name
          <input name="name" required className={field} placeholder="Acme Ltd" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            Primary contact
            <input name="contactName" className={field} />
          </label>
          <label className="text-sm">
            Contact email
            <input name="contactEmail" type="email" className={field} />
          </label>
        </div>
        <label className="block text-sm">
          Source
          <input name="source" className={field} placeholder="Referral / website" />
        </label>
        <Button type="submit">Create client &amp; open case</Button>
      </form>
    </div>
  );
}
