'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, ShieldCheck, Filter, ArrowRight, AlertTriangle } from 'lucide-react';

interface LinkRow {
  id: string; token: string; companyName: string | null; companyNumber: string | null;
  directorName: string | null; clientEmail: string; firmSlug: string | null; status: string;
  acceptedAt: string | null; hasSignedLetter: boolean; prevAccountantEmail: string | null;
}

/** Only what this screen needs from a clearance request. */
interface ClearanceRow {
  id: string;
  clientName: string | null;
  companyNumber: string | null;
  status: string;
  pendingItems: number;
  receivedItems: number;
}

const FIRMS: Record<string, { label: string; color: string }> = {
  gns: { label: 'GNS Ltd', color: '#cc2229' }, llp: { label: 'GNS LLP', color: '#1e3a8a' }, galaxy: { label: 'Galaxy', color: '#7c3aed' },
};

/** Loose match: company number when both have one, otherwise the name. */
const sameClient = (l: LinkRow, c: ClearanceRow) =>
  l.companyNumber && c.companyNumber
    ? l.companyNumber === c.companyNumber
    : Boolean(l.companyName && c.clientName &&
        l.companyName.trim().toLowerCase() === c.clientName.trim().toLowerCase());

export default function CompliancePage() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [clearance, setClearance] = useState<ClearanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [firmFilter, setFirmFilter] = useState('all');

  useEffect(() => {
    // Both halves of a client's compliance position: who they are, and what
    // their old accountant still owes. Clearance failing to load must not
    // blank the identity side, so they settle independently.
    fetch('/api/onboarding/links/list').then((r) => r.json())
      .then((d: LinkRow[]) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([])).finally(() => setLoading(false));
    fetch('/api/clearance/list').then((r) => r.json())
      .then((d: ClearanceRow[]) => setClearance(Array.isArray(d) ? d : [])).catch(() => setClearance([]));
  }, []);

  const clients = rows.filter((r) => r.status === 'accepted');
  const filtered = firmFilter === 'all' ? clients : clients.filter((r) => r.firmSlug === firmFilter);
  const withClearance = clients.filter((r) => r.prevAccountantEmail).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AML / KYC Compliance</h1>
          <p className="text-sm text-gray-500 mt-1">Client due-diligence status across all firms — identity checks and professional clearance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={firmFilter} onChange={(e) => setFirmFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
            <option value="all">All Firms</option>
            {Object.entries(FIRMS).map(([s, f]) => <option key={s} value={s}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Signed clients (CDD applies)', value: clients.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Clearance in progress', value: withClearance, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'No previous accountant', value: clients.length - withClearance, color: 'text-blue-700', bg: 'bg-blue-50' },
        ].map((c) => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-900">
          Each signed client must complete identity verification (Photo ID + Proof of Address, chased every 2 days) and, where applicable, professional clearance. Open a client to see and update their document status.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw size={22} className="animate-spin text-purple-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><ShieldCheck size={24} className="text-blue-500" /></div>
          <p className="text-gray-900 font-semibold">No signed clients yet</p>
          <p className="text-sm text-gray-500 mt-1">Compliance records appear here once a client signs.</p>
        </div>
      ) : (
        <div className="gns-reveal bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-50">
          {filtered.map((r) => {
            const firm = r.firmSlug ? FIRMS[r.firmSlug] : null;
            const cl = clearance.find((c) => sameClient(r, c));
            const total = cl ? cl.pendingItems + cl.receivedItems : 0;
            return (
              <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-gray-50 group">
                <Link href={`/staff/clients/${r.token}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 group-hover:text-blue-700">{r.companyName}</p>
                    {firm && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${firm.color}18`, color: firm.color }}>{firm.label}</span>}
                  </div>
                  <p className="text-sm text-gray-500">{r.directorName} · {r.clientEmail}</p>
                </Link>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={12} /> KYC pending</span>

                  {/* The clearance side of the same client's compliance, in the
                      same boxes used on the clearance and handover screens. It
                      was only reachable from a different menu before, so the
                      two halves of one obligation never appeared together. */}
                  {cl ? (
                    <Link
                      href={`/staff/clearance/${cl.id}`}
                      title={`${cl.receivedItems} of ${total} received — open the clearance request`}
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors ${
                        cl.pendingItems === 0
                          ? 'bg-green-100 border-green-300 text-green-900 hover:bg-green-200'
                          : 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                      }`}
                    >
                      Clearance {cl.receivedItems}/{total}
                    </Link>
                  ) : r.prevAccountantEmail ? (
                    <span className="px-2 py-0.5 rounded-md border border-gray-200 bg-white text-[11px] font-semibold text-gray-400"
                          title="A previous accountant is on file but no clearance request has been raised">
                      Clearance not raised
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md border border-gray-200 bg-white text-[11px] font-semibold text-gray-400"
                          title="No previous accountant — nothing to request">
                      No clearance needed
                    </span>
                  )}

                  <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
