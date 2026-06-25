import Link from "next/link";
import { can, listCasesForSession } from "@gns/core";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** Staff case pipeline (A6 §3.1, FR-WF-1). */
export default async function StaffCasesPage() {
  const session = requireSession();
  if (!can(session, "view_assigned_cases")) {
    return <p className="text-sm text-amber-600">You don&apos;t have access to cases.</p>;
  }

  let rows: Awaited<ReturnType<typeof listCasesForSession>> = [];
  let dbError = false;
  try {
    rows = await listCasesForSession(session);
  } catch {
    dbError = true;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Onboarding cases</h1>
        <Link href="/staff/cases/new">
          <Button size="sm">+ New client</Button>
        </Link>
      </div>

      {dbError ? (
        <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Database not reachable. Start it, run <code>pnpm db:migrate</code> and{" "}
          <code>pnpm --filter @gns/db seed</code>.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Reference</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Risk</th>
                <th className="px-4 py-2 font-medium">Opened</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-muted-foreground" colSpan={4}>
                    No cases yet — create your first client.
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <Link href={`/staff/cases/${c.id}`} className="font-medium text-primary">
                      {c.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{c.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">{c.riskRating ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {c.openedAt ? new Date(c.openedAt).toLocaleDateString("en-GB") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
