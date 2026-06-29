import Link from "next/link";
import { getDb } from "@gns/db";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, Send } from "lucide-react";

interface ClearanceRow {
  id: string;
  caseId: string;
  prevFirmName: string;
  prevFirmEmail: string | null;
  status: string;
  sentAt: Date | null;
  nextChaseAt: Date | null;
  clientName: string | null;
  companyNumber: string | null;
  chaseCount: number;
  pendingItems: number;
  receivedItems: number;
}

async function getAllClearanceRequests(): Promise<ClearanceRow[]> {
  const db = getDb();
  try {
    const rows = await db.execute(`
      SELECT
        pcr.id,
        pcr.case_id as "caseId",
        pcr.prev_firm_name as "prevFirmName",
        pcr.prev_firm_email as "prevFirmEmail",
        pcr.status,
        pcr.sent_at as "sentAt",
        pcr.next_chase_at as "nextChaseAt",
        pcr.response_data as "responseData",
        c.name as "clientName",
        c.company_number as "companyNumber",
        (SELECT COUNT(*)::int FROM clearance_followups cf WHERE cf.request_id = pcr.id) as "chaseCount"
      FROM professional_clearance_requests pcr
      LEFT JOIN onboarding_cases oc ON oc.id = pcr.case_id
      LEFT JOIN clients c ON c.id = oc.client_id
      WHERE pcr.outcome IS NULL OR pcr.outcome = 'clear'
      ORDER BY pcr.sent_at DESC NULLS LAST
      LIMIT 100
    `) as { rows: Array<{
      id: string; caseId: string; prevFirmName: string; prevFirmEmail: string | null;
      status: string; sentAt: Date | null; nextChaseAt: Date | null;
      responseData: unknown; clientName: string | null; companyNumber: string | null;
      chaseCount: number;
    }> };

    return rows.rows.map(r => {
      const rd = (r.responseData ?? {}) as { docItems?: Array<{ status: string }> };
      const items = rd.docItems ?? [];
      return {
        ...r,
        pendingItems: items.filter(i => i.status === 'pending').length,
        receivedItems: items.filter(i => i.status === 'received').length,
      };
    });
  } catch {
    return [];
  }
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  sent:     { bg: 'bg-blue-50',   text: 'text-blue-700',  label: 'Sent' },
  chased:   { bg: 'bg-amber-50',  text: 'text-amber-700', label: 'Chased' },
  received: { bg: 'bg-green-50',  text: 'text-green-700', label: 'Received' },
  draft:    { bg: 'bg-gray-100',  text: 'text-gray-600',  label: 'Draft' },
  declined: { bg: 'bg-red-50',    text: 'text-red-700',   label: 'Declined' },
};

export default async function ClearanceOverviewPage() {
  const session = await getSession();
  if (!session) return notFound();

  const requests = await getAllClearanceRequests();
  const pending = requests.filter(r => r.status !== 'received' && r.status !== 'declined');
  const done = requests.filter(r => r.status === 'received' || r.status === 'declined');

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Professional Clearance</h1>
          <p className="text-sm text-gray-500 mt-1">
            All clearance requests across GNS Associates — ICAEW Code of Ethics R320.7
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
            <p className="text-xs text-gray-400">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{done.length}</p>
            <p className="text-xs text-gray-400">Complete</p>
          </div>
        </div>
      </div>

      {/* Pending requests */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-amber-500" />
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Awaiting Response</h2>
          </div>
          {pending.map(r => (
            <ClearanceCard key={r.id} r={r} />
          ))}
        </section>
      )}

      {requests.length === 0 && (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Send size={24} className="text-blue-500" />
          </div>
          <p className="text-gray-900 font-semibold">No clearance requests yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-6">
            Clearance requests are created automatically when a client signs their engagement letter,
            or you can create one manually from a case.
          </p>
          <Link href="/onboarding"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl text-sm"
            style={{ background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}>
            Start New Onboarding
          </Link>
        </div>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-green-500" />
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Completed</h2>
          </div>
          {done.map(r => (
            <ClearanceCard key={r.id} r={r} faded />
          ))}
        </section>
      )}
    </div>
  );
}

function ClearanceCard({ r, faded = false }: { r: ClearanceRow; faded?: boolean }) {
  const s = STATUS_STYLE[r.status] ?? STATUS_STYLE['sent']!;
  const overdue = r.nextChaseAt && new Date(r.nextChaseAt) < new Date() && r.status !== 'received';
  const total = r.pendingItems + r.receivedItems;
  const pct = total > 0 ? Math.round((r.receivedItems / total) * 100) : 0;

  return (
    <Link href={`/staff/cases/${r.caseId}/clearance`}
      className={`block bg-white border rounded-2xl p-4 hover:shadow-md transition-all group ${
        faded ? 'border-gray-100 opacity-60 hover:opacity-100' : 'border-gray-200'
      }`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
              {s.label}
            </span>
            {overdue && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600">
                <AlertTriangle size={10} /> Chase overdue
              </span>
            )}
            {r.chaseCount > 0 && (
              <span className="text-xs text-gray-400">{r.chaseCount} chase{r.chaseCount !== 1 ? 's' : ''} sent</span>
            )}
          </div>
          <p className="font-bold text-gray-900">
            {r.clientName || 'Unknown Client'}
            {r.companyNumber && <span className="font-normal text-gray-400 text-sm ml-2">· {r.companyNumber}</span>}
          </p>
          <p className="text-sm text-gray-500">Previous: {r.prevFirmName}{r.prevFirmEmail && ` · ${r.prevFirmEmail}`}</p>
          {r.sentAt && (
            <p className="text-xs text-gray-400 mt-1">
              Sent {new Date(r.sentAt).toLocaleDateString('en-GB')}
              {r.nextChaseAt && r.status !== 'received' &&
                ` · Next chase ${new Date(r.nextChaseAt).toLocaleDateString('en-GB')}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {total > 0 && (
            <div className="text-right">
              <p className="text-xs font-bold text-gray-700">{r.receivedItems}/{total} docs</p>
              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{pct}% received</p>
            </div>
          )}
          <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}
