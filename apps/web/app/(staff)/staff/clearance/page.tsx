'use client';
import { useState, useEffect } from 'react';
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

const DOC_PIVOT_LABELS = [
  'Bookkeeping Files',
  'P&L / Balance Sheet',
  'YTD Trial Balance',
  'Director Tax Returns',
  'Online Access',
  'Tax References',
  'Payroll RTI',
  'VAT Returns',
  'HMRC Correspondence',
];

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

  useEffect(() => {
    fetch('/api/clearance/list')
      .then(r => r.json())
      .then((data: ClearanceRow[]) => setRows(data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  const filtered = rows.filter(r => {
    if (firmFilter !== 'all' && r.firmSlug !== firmFilter) return false;
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
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

        {/* Firm filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={firmFilter}
            onChange={e => setFirmFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            <option value="all">All Firms</option>
            {Object.entries(FIRM_LABELS).map(([slug, { label }]) => (
              <option key={slug} value={slug}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-purple-500" />
        </div>
      ) : viewMode === 'pivot' ? (
        <PivotView rows={filtered} />
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

function PivotView({ rows }: { rows: ClearanceRow[] }) {
  const firms = Object.entries(FIRM_LABELS);

  return (
    <div className="space-y-6">
      {/* Outstanding docs by firm */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Outstanding Documents by Firm</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pending items across all active clearance requests</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Type</th>
                {firms.map(([slug, { label, color }]) => (
                  <th key={slug} className="px-4 py-3 text-center text-xs font-semibold" style={{ color }}>
                    {label.replace('GNS Associates ', '')}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">All Firms</th>
              </tr>
            </thead>
            <tbody>
              {DOC_PIVOT_LABELS.map((label, i) => {
                const getCount = (slug: string) =>
                  rows
                    .filter(r => r.firmSlug === slug)
                    .reduce((sum, r) => sum + r.pendingItems, 0);
                const totalCount = rows.reduce((sum, r) => sum + r.pendingItems, 0);

                return (
                  <tr key={label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-5 py-3 text-gray-700 font-medium">{label}</td>
                    {firms.map(([slug]) => {
                      const n = getCount(slug);
                      return (
                        <td key={slug} className="px-4 py-3 text-center">
                          {n > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{n}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      {totalCount > 0 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold">{totalCount}</span>
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
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Status Summary by Firm</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Firm</th>
                {(['sent', 'chased', 'received', 'declined'] as const).map(st => (
                  <th key={st} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide capitalize">{STATUS_META[st]?.label}</th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {firms.map(([slug, { label, color }], i) => {
                const firmRows = rows.filter(r => r.firmSlug === slug);
                return (
                  <tr key={slug} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-5 py-3 font-semibold" style={{ color }}>{label}</td>
                    {(['sent', 'chased', 'received', 'declined'] as const).map(st => {
                      const n = firmRows.filter(r => r.status === st).length;
                      const meta = STATUS_META[st]!;
                      return (
                        <td key={st} className="px-4 py-3 text-center">
                          {n > 0 ? (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${meta.bg} ${meta.text}`}>{n}</span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-gray-700">{firmRows.length}</span>
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
