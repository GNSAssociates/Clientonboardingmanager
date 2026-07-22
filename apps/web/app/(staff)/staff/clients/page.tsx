'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Users, Filter, Plus, FilePlus2, ArrowRight, Search, BellRing, Trash2, Eraser, PlayCircle, Banknote, Pencil, Building2 } from 'lucide-react';

interface LinkRow {
  id: string;
  token: string;
  companyName: string | null;
  companyNumber: string | null;
  directorName: string | null;
  clientEmail: string;
  firmSlug: string | null;
  status: string;
  sentAt: string | null;
  acceptedAt: string | null;
  updatedAt: string | null;
  draftStep: string | null;
  sendMode: string;
  hasSignedLetter: boolean;
  services: Array<{ name: string; price: number; oneoff?: boolean }>;
}

// Human label for where an in-progress draft was left off
const DRAFT_STEP_LABEL: Record<string, string> = {
  services: 'Services & fees',
  company: 'Company details',
  preview: 'Ready to send',
};

const FIRMS: Record<string, { label: string; color: string }> = {
  gns:    { label: 'GNS Associates Ltd',    color: '#cc2229' },
  llp:    { label: 'GNS Associates UK LLP', color: '#1e3a8a' },
  galaxy: { label: 'Galaxy Accountants',    color: '#7c3aed' },
};

const STATUS: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Draft — in progress', cls: 'bg-amber-50 text-amber-700' },
  sent:     { label: 'Awaiting signature', cls: 'bg-blue-50 text-blue-700' },
  accepted: { label: 'Signed client',      cls: 'bg-green-50 text-green-700' },
  expired:  { label: 'Link expired',       cls: 'bg-gray-100 text-gray-500' },
};

export default function ClientsPage() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [firmFilter, setFirmFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    fetch('/api/onboarding/links/list')
      .then((r) => r.json())
      .then((data: LinkRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remind = async (r: LinkRow) => {
    setBusy(r.id); setToast('');
    try {
      const res = await fetch(`/api/onboarding/links/${r.id}/resend`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      setToast(res.ok ? `✅ ${d.message}` : `❌ ${d.error ?? 'Reminder failed'}`);
    } finally { setBusy(null); }
  };

  const del = async (r: LinkRow) => {
    if (!confirm(`Delete ${r.companyName ?? 'this client'} and all their data? This cannot be undone.`)) return;
    setBusy(r.id); setToast('');
    try {
      const res = await fetch(`/api/onboarding/links/${r.token}`, { method: 'DELETE' });
      if (res.ok) { setToast(`🗑️ ${r.companyName} deleted`); load(); }
      else setToast('❌ Delete failed');
    } finally { setBusy(null); }
  };

  const moveFirm = async (r: LinkRow, firmSlug: string) => {
    if (firmSlug === r.firmSlug) return;
    setBusy(r.id); setToast('');
    try {
      const res = await fetch(`/api/onboarding/links/${r.token}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmSlug }),
      });
      if (res.ok) { setToast(`↪ ${r.companyName ?? 'Client'} moved to ${FIRMS[firmSlug]?.label ?? firmSlug}`); load(); }
      else setToast('❌ Move failed');
    } finally { setBusy(null); }
  };

  const editClient = async (r: LinkRow) => {
    const companyName = prompt('Client / company name:', r.companyName ?? '');
    if (companyName === null) return;
    const directorName = prompt('Primary contact name:', r.directorName ?? '');
    if (directorName === null) return;
    const clientEmail = prompt('Client email:', r.clientEmail ?? '');
    if (clientEmail === null) return;
    setBusy(r.id); setToast('');
    try {
      const res = await fetch(`/api/onboarding/links/${r.token}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, directorName, clientEmail }),
      });
      if (res.ok) { setToast('✏️ Client details updated'); load(); }
      else setToast('❌ Update failed');
    } finally { setBusy(null); }
  };

  const clearAll = async () => {
    if (!confirm('Delete ALL client data for a fresh start? Every client, letter, clearance and document record will be removed. This cannot be undone.')) return;
    if (prompt('Type DELETE ALL to confirm') !== 'DELETE ALL') { setToast('Cancelled — nothing was deleted.'); return; }
    setBusy('all'); setToast('');
    try {
      const res = await fetch('/api/admin/clear-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'DELETE ALL' }) });
      if (res.ok) { setToast('🧹 All data cleared — starting fresh.'); load(); }
      else setToast('❌ Clear failed');
    } finally { setBusy(null); }
  };

  const processDD = async () => {
    setBusy('dd'); setToast('');
    try {
      const res = await fetch('/api/admin/gocardless-process-pending', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setToast(`💳 Direct Debits: ${d.created} created, ${d.skipped} already set up, ${d.failed} failed.`);
      else setToast(`❌ ${d.error ?? 'GoCardless setup failed'}`);
      load();
    } finally { setBusy(null); }
  };

  // One card per client company (latest link wins — list API is newest-first)
  const seen = new Set<string>();
  const clients = rows.filter((r) => {
    const key = `${r.firmSlug}:${(r.companyNumber || r.companyName || r.clientEmail).toString().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const filtered = clients.filter((r) => {
    if (firmFilter !== 'all' && r.firmSlug !== firmFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (q) {
      const hay = `${r.companyName} ${r.companyNumber} ${r.directorName} ${r.clientEmail}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const statusCounts = {
    all: clients.length,
    draft: clients.filter((r) => r.status === 'draft').length,
    sent: clients.filter((r) => r.status === 'sent').length,
    accepted: clients.filter((r) => r.status === 'accepted').length,
    expired: clients.filter((r) => r.status === 'expired').length,
  };

  const STATUS_TABS: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'accepted', label: 'Signed' },
    { key: 'expired', label: 'Expired' },
  ];

  const monthlyOf = (r: LinkRow) => (r.services || []).filter((s) => !s.oneoff).reduce((t, s) => t + s.price, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every client per firm — open a client to see their letters, bank mandate, documents and clearance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={processDD}
            disabled={busy === 'dd'}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:border-gray-500"
            title="Create GoCardless mandates for signed clients who don't have one yet"
          >
            {busy === 'dd' ? <RefreshCw size={15} className="animate-spin" /> : <Banknote size={15} />} Set up pending Direct Debits
          </button>
          <button
            onClick={clearAll}
            disabled={busy === 'all'}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50"
            title="Delete all client data for a fresh start"
          >
            {busy === 'all' ? <RefreshCw size={15} className="animate-spin" /> : <Eraser size={15} />} Clear all data
          </button>
          <Link
            href="/onboarding"
            className="flex items-center gap-2 px-4 py-2.5 text-white font-semibold rounded-xl text-sm"
            style={{ background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}
          >
            <Plus size={16} /> Add Client
          </Link>
        </div>
      </div>

      {toast && (
        <div className="px-4 py-3 rounded-xl bg-gray-900 text-white text-sm">{toast}</div>
      )}

      {/* Firm summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(FIRMS).map(([slug, f]) => {
          const n = clients.filter((c) => c.firmSlug === slug).length;
          const signed = clients.filter((c) => c.firmSlug === slug && c.status === 'accepted').length;
          const drafts = clients.filter((c) => c.firmSlug === slug && c.status === 'draft').length;
          return (
            <button
              key={slug}
              onClick={() => setFirmFilter(firmFilter === slug ? 'all' : slug)}
              className={`rounded-xl p-4 text-left border-2 transition-all ${firmFilter === slug ? 'bg-white shadow' : 'bg-white/60 border-transparent hover:bg-white'}`}
              style={firmFilter === slug ? { borderColor: f.color } : {}}
            >
              <p className="text-xs font-semibold" style={{ color: f.color }}>{f.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{n}</p>
              <p className="text-xs text-gray-500">{signed} signed{drafts ? ` · ${drafts} in progress` : ''}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, number, director or email…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={firmFilter} onChange={(e) => setFirmFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
            <option value="all">All Firms</option>
            {Object.entries(FIRMS).map(([slug, f]) => <option key={slug} value={slug}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 -mb-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.key
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
              statusFilter === tab.key ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {statusCounts[tab.key as keyof typeof statusCounts]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-purple-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-purple-500" />
          </div>
          <p className="text-gray-900 font-semibold">No clients yet</p>
          <p className="text-sm text-gray-500 mt-1">Click &ldquo;Add Client&rdquo; to start an onboarding.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const firm = r.firmSlug ? FIRMS[r.firmSlug] : null;
            const isDraft = r.status === 'draft';
            const st = STATUS[r.status] ?? STATUS.sent!;
            const monthly = monthlyOf(r);
            const resumeHref = `/onboarding/services?draft=${r.token}&firm=${r.firmSlug ?? 'gns'}`;
            const detailHref = isDraft ? resumeHref : `/staff/clients/${r.token}`;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap hover:shadow-sm transition-shadow">
                <Link href={detailHref} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span>
                    {isDraft && r.draftStep && DRAFT_STEP_LABEL[r.draftStep] && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">
                        at: {DRAFT_STEP_LABEL[r.draftStep]}
                      </span>
                    )}
                    {firm && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${firm.color}18`, color: firm.color }}>
                        {firm.label}
                      </span>
                    )}
                    {monthly > 0 && <span className="text-xs text-gray-400">£{monthly}/month</span>}
                  </div>
                  <p className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                    {r.companyName ?? (isDraft ? 'Untitled draft' : '—')}
                    {r.companyNumber && <span className="font-normal text-gray-400 text-sm ml-2">· {r.companyNumber}</span>}
                  </p>
                  <p className="text-sm text-gray-500">{r.directorName ? `${r.directorName} · ` : ''}{r.clientEmail || 'no email yet'}</p>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isDraft && (
                    <Link
                      href={resumeHref}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}
                      title="Resume this in-progress onboarding where you left off"
                    >
                      <PlayCircle size={13} /> Resume
                    </Link>
                  )}
                  {r.status === 'sent' && (
                    <button
                      onClick={() => remind(r)}
                      disabled={busy === r.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50"
                      title="Resend the engagement letter to the client"
                    >
                      {busy === r.id ? <RefreshCw size={13} className="animate-spin" /> : <BellRing size={13} />} Remind
                    </button>
                  )}
                  {!isDraft && (
                    <Link
                      href={`/onboarding/services?firm=${r.firmSlug ?? 'gns'}&companyNumber=${encodeURIComponent(r.companyNumber ?? '')}&directorEmail=${encodeURIComponent(r.clientEmail)}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-500"
                      title="Start a new engagement with this client's details pre-filled"
                    >
                      <FilePlus2 size={13} /> New Engagement
                    </Link>
                  )}
                  {/* Move client to another firm */}
                  <div className="relative flex items-center" title="Move this client to another firm">
                    <Building2 size={13} className="absolute left-1.5 text-gray-400 pointer-events-none" />
                    <select
                      value={r.firmSlug ?? 'gns'}
                      onChange={(e) => moveFirm(r, e.target.value)}
                      disabled={busy === r.id}
                      className="appearance-none pl-6 pr-6 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 bg-white hover:border-gray-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      {Object.entries(FIRMS).map(([slug, f]) => <option key={slug} value={slug}>{f.label}</option>)}
                    </select>
                  </div>
                  <button onClick={() => editClient(r)} disabled={busy === r.id} className="p-2 text-gray-400 hover:text-blue-600" title="Edit client details">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => del(r)} disabled={busy === r.id} className="p-2 text-gray-400 hover:text-red-500" title="Delete client">
                    <Trash2 size={15} />
                  </button>
                  <Link href={detailHref} className="p-2 text-gray-400 hover:text-gray-700">
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
