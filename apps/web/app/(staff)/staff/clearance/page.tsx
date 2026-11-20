'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, Clock, AlertTriangle, ArrowRight, Send,
  Filter, BarChart2, FileText, RefreshCw,
} from 'lucide-react';

interface ClearanceRow {
  id: string;
  caseId: string | null;
  linkToken: string | null;
  prevFirmName: string;
  prevFirmEmail: string | null;
  status: string;
  sentAt: string | null;
  nextChaseAt: string | null;
  clientName: string | null;
  companyNumber: string | null;
  chaseCount: number;
  pendingItems: number;
  receivedItems: number;
  firmSlug: string | null;
  /** The individual documents, so the pivot can count by type rather than
   *  showing one firm total against every row. */
  items?: Array<{ id: string; label: string; status: string }>;
}

const STATUS_META: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  sent:     { bg: 'bg-blue-50',   text: 'text-blue-700',  label: 'Sent',     dot: 'bg-blue-500' },
  chased:   { bg: 'bg-amber-50',  text: 'text-amber-700', label: 'Chased',   dot: 'bg-amber-500' },
  received: { bg: 'bg-green-50',  text: 'text-green-700', label: 'Received', dot: 'bg-green-500' },
  declined: { bg: 'bg-red-50',    text: 'text-red-700',   label: 'Declined', dot: 'bg-red-500' },
  draft:    { bg: 'bg-gray-100',  text: 'text-gray-600',  label: 'Draft',    dot: 'bg-gray-400' },
  timed_out:{ bg: 'bg-gray-50',   text: 'text-gray-500',  label: 'Timed Out',dot: 'bg-gray-400' },
};

const FIRM_LABELS: Record<string, { label: string; color: string }> = {
  gns:    { label: 'GNS Associates Limited', color: '#cc2229' },
  llp:    { label: 'GNS Associates UK LLP',  color: '#1e3a8a' },
  galaxy: { label: 'Galaxy Accountants',     color: '#7c3aed' },
};

function clearanceHref(r: ClearanceRow) {
  if (r.caseId) return `/staff/cases/${r.caseId}/clearance`;
  return `/staff/clearance/${r.id}`;
}

export default function ClearanceOverviewPage() {
  const [rows, setRows] = useState<ClearanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'awaiting' | 'overdue' | 'complete'>('all');
  const [firmFilter, setFirmFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'pivot'>('list');
  /* Set by clicking a number in one of the pivot tables. A count nobody can
     open is a number you have to go and reproduce by hand, which is how these
     screens end up unused. */
  const [drill, setDrill] = useState<{ itemId: string | null; label: string; status?: string } | null>(null);

  // Reusable, so a newly raised request shows up without reloading the page.
  const load = useCallback(() => {
    fetch('/api/clearance/list')
      .then(r => r.json())
      .then((data: ClearanceRow[]) => setRows(data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();

  const filtered = rows.filter(r => {
    if (firmFilter !== 'all' && r.firmSlug !== firmFilter) return false;
    // Set by clicking a number in the pivot: show only the clients who still
    // owe that one document, or who are at that one status.
    if (drill?.itemId && !(r.items ?? []).some(i => i.id === drill.itemId && i.status === 'pending')) return false;
    if (drill?.status && r.status !== drill.status) return false;
    if (tab === 'awaiting') return r.status === 'sent' || r.status === 'chased';
    if (tab === 'overdue') {
      const isActive = r.status === 'sent' || r.status === 'chased';
      const isDue = r.nextChaseAt && new Date(r.nextChaseAt) < now;
      return isActive && isDue;
    }
    if (tab === 'complete') return r.status === 'received' || r.status === 'declined' || r.status === 'timed_out';
    return true;
  });

  const awaiting = rows.filter(r => r.status === 'sent' || r.status === 'chased').length;
  const overdue  = rows.filter(r => (r.status === 'sent' || r.status === 'chased') && r.nextChaseAt && new Date(r.nextChaseAt) < now).length;
  const complete = rows.filter(r => r.status === 'received' || r.status === 'declined' || r.status === 'timed_out').length;

  const tabs = [
    { key: 'all',      label: 'All',      count: rows.length },
    { key: 'awaiting', label: 'Awaiting', count: awaiting },
    { key: 'overdue',  label: 'Overdue',  count: overdue },
    { key: 'complete', label: 'Complete', count: complete },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto px-4 py-5 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Professional Clearance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track handover requests to previous accountants — ICAEW R320.7 · Auto-chased every 5 days
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileText size={14} className="inline mr-1" />List
            </button>
            <button
              onClick={() => setViewMode('pivot')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${viewMode === 'pivot' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BarChart2 size={14} className="inline mr-1" />Pivot
            </button>
          </div>
          <Link
            href="/onboarding"
            className="px-4 py-2 text-white font-semibold rounded-xl text-sm"
            style={{ background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}
          >
            + New Onboarding
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: rows.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Awaiting Response', value: awaiting, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Overdue Chase', value: overdue, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Complete', value: complete, color: 'text-green-700', bg: 'bg-green-50' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Status tabs */}
        <div className="flex gap-1 border border-gray-200 rounded-xl p-1 bg-white">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Firm filter — clickable pills (click to filter, click again to clear) */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-400" />
          <button
            type="button"
            onClick={() => setFirmFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${firmFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            All Firms
          </button>
          {Object.entries(FIRM_LABELS).map(([slug, { label, color }]) => {
            const active = firmFilter === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => setFirmFilter(active ? 'all' : slug)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all inline-flex items-center gap-2 ${active ? 'text-white' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                style={active ? { background: color, borderColor: color } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: active ? '#fff' : color }} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* What a drill-down narrowed the list to, and the way back out. A list
          that is quietly filtered reads as "there are only three" rather than
          "you are looking at three of forty". */}
      {drill && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="text-sm text-amber-900">
            Showing <b>{filtered.length}</b> {filtered.length === 1 ? 'request' : 'requests'}
            {drill.itemId ? <> still owing <b>{drill.label}</b></> : <> at <b>{drill.label}</b></>}
            {firmFilter !== 'all' && <> — {FIRM_LABELS[firmFilter]?.label ?? firmFilter}</>}
          </p>
          <button
            type="button"
            onClick={() => { setDrill(null); setFirmFilter('all'); }}
            className="shrink-0 text-xs font-semibold text-amber-800 hover:text-amber-950 underline"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-purple-500" />
        </div>
      ) : viewMode === 'pivot' ? (
        <PivotView
          rows={filtered}
          onDrill={(slug, itemId, status) => {
            setFirmFilter(slug);
            setTab('all');
            const label =
              itemId
                ? (rows.flatMap(r => r.items ?? []).find(i => i.id === itemId)?.label ?? 'that document')
                : status
                  ? (STATUS_META[status]?.label ?? status)
                  : 'all requests';
            setDrill({ itemId: itemId ?? null, label, status });
            setViewMode('list');
          }}
        />
      ) : (
        <ListView rows={filtered} now={now} />
      )}
    </div>
  );
}

function ListView({ rows, now }: { rows: ClearanceRow[]; now: Date }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Send size={24} className="text-blue-500" />
        </div>
        <p className="text-gray-900 font-semibold">No clearance requests</p>
        <p className="text-sm text-gray-500 mt-1">
          Clearance requests are created automatically when a client signs their engagement letter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map(r => <ClearanceCard key={r.id} r={r} now={now} />)}
    </div>
  );
}

function ClearanceCard({ r, now }: { r: ClearanceRow; now: Date }) {
  const s = STATUS_META[r.status] ?? STATUS_META['sent']!;
  const overdue = r.nextChaseAt && new Date(r.nextChaseAt) < now && r.status !== 'received';
  const total = r.pendingItems + r.receivedItems;
  const pct = total > 0 ? Math.round((r.receivedItems / total) * 100) : 0;
  const firm = r.firmSlug ? FIRM_LABELS[r.firmSlug] : null;

  return (
    <Link
      href={clearanceHref(r)}
      className="block bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
              {s.label}
            </span>
            {overdue && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600">
                <AlertTriangle size={10} /> Chase overdue
              </span>
            )}
            {r.chaseCount > 0 && (
              <span className="text-xs text-gray-400">{r.chaseCount} chase{r.chaseCount !== 1 ? 's' : ''}</span>
            )}
            {firm && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${firm.color}18`, color: firm.color }}
              >
                {firm.label}
              </span>
            )}
          </div>
          <p className="font-bold text-gray-900">
            {r.clientName || 'Awaiting Case Setup'}
            {r.companyNumber && <span className="font-normal text-gray-400 text-sm ml-2">· {r.companyNumber}</span>}
          </p>
          <p className="text-sm text-gray-500">Previous: {r.prevFirmName}{r.prevFirmEmail && ` · ${r.prevFirmEmail}`}</p>
          {r.sentAt && (
            <p className="text-xs text-gray-400 mt-1">
              Sent {new Date(r.sentAt).toLocaleDateString('en-GB')}
              {r.nextChaseAt && r.status !== 'received' && (
                <span className={overdue ? 'text-red-500 font-semibold' : ''}>
                  {' '}· {overdue ? 'Chase due' : 'Next chase'} {new Date(r.nextChaseAt).toLocaleDateString('en-GB')}
                </span>
              )}
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
              <p className="text-xs text-gray-400 mt-0.5">{pct}%</p>
            </div>
          )}
          <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

function PivotView({
  rows, onDrill,
}: {
  rows: ClearanceRow[];
  onDrill: (firmSlug: string | 'all', itemId: string | null, status?: string) => void;
}) {
  const firms = Object.entries(FIRM_LABELS);

  /* The document types actually outstanding, taken from the requests
     themselves. This used to be a hard-coded list of nine labels counted with
     a function that ignored which label it was on, so every row showed the
     same number — the firm's total pending items, repeated nine times. A
     clearance manager reading "Bookkeeping Files: 6, VAT Returns: 6" would
     chase six things that were never outstanding. */
  const docTypes = (() => {
    const seen = new Map<string, string>();
    for (const r of rows) for (const it of r.items ?? []) if (!seen.has(it.id)) seen.set(it.id, it.label);
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  })();

  const pendingCount = (rs: ClearanceRow[], itemId: string) =>
    rs.reduce((n, r) => n + (r.items ?? []).filter(i => i.id === itemId && i.status === 'pending').length, 0);

  return (
    <div className="space-y-4">
      {/* Outstanding docs by firm */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Outstanding Documents by Firm</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pending items across all active clearance requests — click any number to see whose
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Type</th>
                {firms.map(([slug, { label, color }]) => (
                  <th key={slug} className="px-3 py-2 text-center text-xs font-semibold" style={{ color }}>
                    {label.replace('GNS Associates ', '')}
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">All Firms</th>
              </tr>
            </thead>
            <tbody>
              {docTypes.length === 0 && (
                <tr><td colSpan={firms.length + 2} className="px-5 py-6 text-center text-sm text-gray-400">
                  Nothing outstanding.
                </td></tr>
              )}
              {docTypes.map(({ id, label }, i) => {
                const totalCount = pendingCount(rows, id);
                return (
                  <tr key={id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-1.5 text-gray-700 font-medium">{label}</td>
                    {firms.map(([slug]) => {
                      const n = pendingCount(rows.filter(r => r.firmSlug === slug), id);
                      return (
                        <td key={slug} className="px-3 py-1.5 text-center">
                          {n > 0 ? (
                            <button
                              type="button"
                              onClick={() => onDrill(slug, id)}
                              title={`Show the ${n} client${n === 1 ? '' : 's'} still owing this`}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold hover:bg-amber-200 hover:ring-2 hover:ring-amber-300 transition"
                            >{n}</button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-center">
                      {totalCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => onDrill('all', id)}
                          title={`Show every client still owing this`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 transition"
                        >{totalCount}</button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status summary by firm */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Status Summary by Firm</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Firm</th>
                {(['sent', 'chased', 'received', 'declined'] as const).map(st => (
                  <th key={st} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide capitalize">{STATUS_META[st]?.label}</th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {firms.map(([slug, { label, color }], i) => {
                const firmRows = rows.filter(r => r.firmSlug === slug);
                return (
                  <tr key={slug} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-1.5 font-semibold" style={{ color }}>{label}</td>
                    {(['sent', 'chased', 'received', 'declined'] as const).map(st => {
                      const n = firmRows.filter(r => r.status === st).length;
                      const meta = STATUS_META[st]!;
                      return (
                        <td key={st} className="px-3 py-1.5 text-center">
                          {n > 0 ? (
                            <button
                              type="button"
                              onClick={() => onDrill(slug, null, st)}
                              title={`Show these ${n}`}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition hover:ring-2 hover:ring-gray-300 ${meta.bg} ${meta.text}`}
                            >{n}</button>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-center">
                      {firmRows.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => onDrill(slug, null)}
                          title={`Show all ${firmRows.length} for this firm`}
                          className="text-sm font-bold text-gray-700 hover:text-blue-600 hover:underline"
                        >{firmRows.length}</button>
                      ) : <span className="text-sm font-bold text-gray-300">0</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
