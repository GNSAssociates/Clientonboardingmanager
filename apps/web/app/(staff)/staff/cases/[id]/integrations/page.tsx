import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCaseDetail, getIntegrationSummary } from "@gns/core";
import { adapters } from "@gns/integrations";

const STATUS_BADGE: Record<string, string> = {
  connected: "bg-green-100 text-green-700",
  pending: "bg-gray-100 text-gray-600",
  expired: "bg-yellow-100 text-yellow-700",
  revoked: "bg-red-100 text-red-700",
  error: "bg-red-100 text-red-700",
};

export default async function IntegrationsPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return notFound();

  let detail: Awaited<ReturnType<typeof getCaseDetail>>;
  try {
    detail = await getCaseDetail(session, params.id);
  } catch {
    return notFound();
  }

  const { case: c, client } = detail;
  const summary = await getIntegrationSummary(session, c.clientId, params.id);

  const xeroAuthUrl = adapters.ledger?.["xero"]?.getAuthUrl(
    `${session.userId}:xero:${Date.now()}&clientId=${c.clientId}`,
  );
  const qboAuthUrl = adapters.ledger?.["qbo"]?.getAuthUrl(
    `${session.userId}:qbo:${Date.now()}&clientId=${c.clientId}`,
  );

  const xeroConn = summary.connections.find((c) => c.provider === "xero");
  const qboConn = summary.connections.find((c) => c.provider === "qbo");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div>
        <a href={`/staff/cases/${params.id}`} className="text-sm text-gray-500 hover:underline">
          &larr; Back to case
        </a>
        <h1 className="text-2xl font-bold mt-1">Accounting Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">{client?.name ?? c.clientId}</p>
      </div>

      {/* Xero */}
      <div className="border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Xero</h2>
          {xeroConn ? (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[xeroConn.status]}`}>
              {xeroConn.status}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">not connected</span>
          )}
        </div>
        {xeroConn?.tenantName && (
          <p className="text-sm text-gray-600">Organisation: <strong>{xeroConn.tenantName}</strong></p>
        )}
        {xeroConn?.lastSyncAt && (
          <p className="text-xs text-gray-400">Last sync: {new Date(xeroConn.lastSyncAt).toLocaleString("en-GB")}</p>
        )}
        {!xeroConn || xeroConn.status !== "connected" ? (
          <a
            href={xeroAuthUrl ?? "#"}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Connect Xero
          </a>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {(["trial_balance", "vat", "payroll", "coa"] as const).map((kind) => (
              <form key={kind} method="POST" action={`/api/v1/cases/${params.id}/ledger`}>
                <input type="hidden" name="entityId" value={session.entityIds[0]} />
                <input type="hidden" name="clientId" value={c.clientId} />
                <input type="hidden" name="connectionId" value={xeroConn.id} />
                <input type="hidden" name="provider" value="xero" />
                <input type="hidden" name="kind" value={kind} />
                <button type="submit" className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
                  Pull {kind.replace("_", " ")}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>

      {/* QuickBooks */}
      <div className="border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">QuickBooks Online</h2>
          {qboConn ? (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[qboConn.status]}`}>
              {qboConn.status}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">not connected</span>
          )}
        </div>
        {!qboConn || qboConn.status !== "connected" ? (
          <a
            href={qboAuthUrl ?? "#"}
            className="inline-block px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Connect QuickBooks
          </a>
        ) : (
          <p className="text-sm text-gray-600">Connected · tenant: {qboConn.tenantId}</p>
        )}
      </div>

      {/* Ledger snapshots */}
      {summary.snapshots.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Ledger Snapshots</h2>
          <div className="border rounded-lg divide-y">
            {summary.snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium capitalize">{s.kind.replace("_", " ")}</span>
                <span className="text-gray-400 text-xs">{s.period ?? "—"}</span>
                <span className="text-gray-500 uppercase text-xs">{s.provider}</span>
                <span className="text-gray-400 text-xs">
                  {new Date(s.pulledAt).toLocaleString("en-GB")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
