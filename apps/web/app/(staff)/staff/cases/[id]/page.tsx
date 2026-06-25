import { notFound } from "next/navigation";
import Link from "next/link";
import { getCaseDetail, listServicesForSession, type CaseDetail } from "@gns/core";
import { CASE_STATUSES, type CaseStatus } from "@gns/config";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { acceptPricingAction, advanceAction, selectServicesAction } from "../actions";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border px-3 py-2 text-sm";

function nextStatus(current: CaseStatus): CaseStatus | undefined {
  const idx = CASE_STATUSES.indexOf(current);
  return CASE_STATUSES[idx + 1];
}

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const session = requireSession();

  let detail: CaseDetail;
  try {
    detail = await getCaseDetail(session, params.id);
  } catch {
    notFound();
  }

  const catalogue = await listServicesForSession(session).catch(() => []);
  const { case: c, client, checklist, services } = detail;
  const selectedIds = new Set(services.map((s) => s.serviceId));
  const next = nextStatus(c.status);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{c.reference}</p>
          <h1 className="text-2xl font-semibold">{client?.name ?? "Client"}</h1>
          <p className="mt-1 text-sm">
            Status: <span className="font-medium">{c.status.replace(/_/g, " ")}</span>
            {c.substatus ? ` · ${c.substatus}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/staff/cases/${c.id}/documents`}>
            <Button variant="outline" size="sm">Documents</Button>
          </Link>
          <Link href={`/staff/cases/${c.id}/letters`}>
            <Button variant="outline" size="sm">Letters & E-sign</Button>
          </Link>
        </div>
      </div>

      {/* Advance */}
      {next && (
        <form action={advanceAction} className="flex items-center gap-3 rounded-md border p-4">
          <input type="hidden" name="caseId" value={c.id} />
          <input type="hidden" name="to" value={next} />
          <span className="text-sm text-muted-foreground">
            Next step: <span className="font-medium">{next.replace(/_/g, " ")}</span>
          </span>
          <Button type="submit" size="sm" className="ml-auto">
            Advance ▸
          </Button>
        </form>
      )}

      {/* Services */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">Services</h2>
        <form action={selectServicesAction} className="mt-3 space-y-2">
          <input type="hidden" name="caseId" value={c.id} />
          {catalogue.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="serviceIds"
                value={s.id}
                defaultChecked={selectedIds.has(s.id)}
              />
              {s.name}
            </label>
          ))}
          {catalogue.length === 0 && (
            <p className="text-sm text-muted-foreground">No services seeded.</p>
          )}
          <Button type="submit" size="sm" variant="outline" className="mt-2">
            Save services
          </Button>
        </form>
      </section>

      {/* Pricing */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">Pricing</h2>
        <form action={acceptPricingAction} className="mt-3 flex items-end gap-3">
          <input type="hidden" name="caseId" value={c.id} />
          <label className="text-sm">
            Agreed total (£)
            <input name="total" type="number" step="0.01" min="0" required className={field} />
          </label>
          <Button type="submit" size="sm">
            Record agreement
          </Button>
        </form>
      </section>

      {/* Checklist */}
      <section className="rounded-lg border p-5">
        <h2 className="font-medium">Document checklist ({checklist.length})</h2>
        <ul className="mt-3 divide-y">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span>{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.status}</span>
            </li>
          ))}
          {checklist.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">No checklist items.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
