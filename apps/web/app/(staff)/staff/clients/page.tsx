'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { feeTotals, gbp } from '@/lib/fees';
import { RefreshCw, Users, Filter, Plus, FilePlus2, ArrowRight, Search, BellRing, Trash2, Eraser, PlayCircle, Banknote, Pencil, Building2, XOctagon, ChevronDown, ChevronRight } from 'lucide-react';

interface LinkRow {
  id: string;
  token: string;
  companyName: string | null;
  clientName: string | null;
  clientType: string | null;
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
  // frequency + chFee are what make an annual fee annual and a Companies
  // House disbursement visible; both were being ignored when totalling.
  services: Array<{ name: string; price: number; oneoff?: boolean; frequency?: string; chFee?: number }>;
}

/** A client and every engagement ever raised for them, newest first. */
interface ClientGroup {
  key: string;
  latest: LinkRow;
  history: LinkRow[];
}

/* WHAT IS THIS CLIENT'S ACTUAL STATE?
 *
 * A client accumulates engagements — a first attempt, a corrected fee, a
 * re-send — and only one gets signed. The card showed the NEWEST one, so a
 * client who signed on the 5th read as "Awaiting signature" because an unsigned
 * copy was raised on the 7th, and the headline fee came from that unsigned copy
 * rather than from the contract. Staff could not tell, at a glance, whether the
 * client was signed, and the fee on screen was not the fee agreed.
 *
 * The signed engagement is the one that matters. */
function signedOf(g: ClientGroup): LinkRow | null {
  const all = [g.latest, ...g.history].filter((r) => r.status === 'accepted');
  // Newest signature wins if somehow there is more than one.
  return all[0] ?? null;
}

/** Unsigned engagements raised BEFORE the signature — the client did sign, just
 *  not this copy. One raised AFTER is a genuinely new engagement, still live. */
function isSuperseded(r: LinkRow, signed: LinkRow | null): boolean {
  if (!signed || r.id === signed.id || r.status === 'accepted') return false;
  const at = signed.acceptedAt ? new Date(signed.acceptedAt).getTime() : 0;
  const mine = r.sentAt ? new Date(r.sentAt).getTime() : 0;
  return at > 0 && mine > 0 && mine <= at;
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
  // Which client card has its earlier engagements open.
  const [openHistory, setOpenHistory] = useState<string | null>(null);

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

  // Archive, never delete. Nothing is destroyed: the record is hidden from this
  // list and the client's OneDrive folder moves to "03 Completed Clients", so the
  // engagement, signed letter and AML trail all remain intact.
  const del = async (r: LinkRow) => {
    if (!confirm(`Archive ${nameOf(r)}?\n\nThey will be removed from this list and their OneDrive folder moved to "Completed Clients". Nothing is deleted — the signed letter and ID documents are kept.`)) return;
    setBusy(r.id); setToast('');
    try {
      const res = await fetch(`/api/onboarding/links/${r.token}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast(
          j.oneDriveMoved === false
            ? `📦 ${nameOf(r)} archived (OneDrive folder not moved: ${j.oneDriveReason ?? 'unknown'})`
            : `📦 ${nameOf(r)} archived`,
        );
        load();
      } else setToast('❌ Archive failed');
    } finally { setBusy(null); }
  };

  // PERMANENT delete — admin only, enforced server-side. Destroys the signed
  // engagement letter and the AML/KYC trail, so it is deliberately awkward: the
  // company name must be typed exactly. Intended for clearing dummy/test records,
  // not for real clients (archive those instead).
  const hardDelete = async (r: LinkRow) => {
    const name = nameOf(r);
    const typed = prompt(
      `PERMANENTLY DELETE "${name}"?\n\n` +
        'This destroys the record, the signed engagement letter and the document/AML trail. ' +
        'It cannot be undone. For a real client use Archive instead.\n\n' +
        `Type the company name exactly to confirm:`,
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== String(name).trim().toLowerCase()) {
      setToast('❌ Name did not match — nothing was deleted.');
      return;
    }
    setBusy(r.id); setToast('');
    try {
      const res = await fetch(`/api/onboarding/links/${r.token}?permanent=1`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { setToast(`🗑️ ${name} permanently deleted`); load(); }
      else setToast(`❌ ${j.error || 'Delete failed'}`);
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

  /* ONE CARD PER CLIENT, BUT EVERY ENGAGEMENT KEPT.
     This used to `return false` for any row after the first per company — so
     creating a second engagement made the first one VANISH from the list. It
     was never deleted; it just had nowhere to appear, and no way to be opened,
     renewed or archived. The newest engagement still leads the card; the
     earlier ones are listed underneath it.

     A row with no company number, no name and no email cannot be identified,
     so it is never grouped — otherwise every blank draft collapsed into one
     card and the rest became unreachable. */
  const groups: ClientGroup[] = [];
  const groupIndex = new Map<string, ClientGroup>();
  rows.forEach((r) => {
    const identity = (r.companyNumber || r.companyName || r.clientName || r.clientEmail || '').trim().toLowerCase();
    const group = identity ? groupIndex.get(`${r.firmSlug}:${identity}`) : undefined;
    if (group) { group.history.push(r); return; }
    const fresh: ClientGroup = { key: r.id, latest: r, history: [] };
    groups.push(fresh);
    if (identity) groupIndex.set(`${r.firmSlug}:${identity}`, fresh);
  });
  const clients = groups.map((g) => g.latest);

  const matches = (r: LinkRow) => {
    if (firmFilter !== 'all' && r.firmSlug !== firmFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (q) {
      const hay = `${r.companyName} ${r.clientName} ${r.companyNumber} ${r.directorName} ${r.clientEmail}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  };
  // A client stays on screen if ANY of their engagements matches — searching
  // for a company must not hide it because only last year's letter matched.
  const filteredGroups = groups.filter((g) => matches(g.latest) || g.history.some(matches));
  const filtered = filteredGroups.map((g) => g.latest);

  /* Count what the tab will actually SHOW. These counted only each client's
     newest engagement while the list keeps a client whose OLDER engagement
     matches, so "Signed (3)" could sit above four cards. A group counts once,
     for any status any of its engagements holds. */
  const hasStatus = (g: ClientGroup, s: string) =>
    g.latest.status === s || g.history.some((h) => h.status === s);
  const inFirm = (g: ClientGroup) =>
    firmFilter === 'all' || g.latest.firmSlug === firmFilter;
  const statusCounts = {
    all: groups.filter(inFirm).length,
    draft: groups.filter((g) => inFirm(g) && hasStatus(g, 'draft')).length,
    sent: groups.filter((g) => inFirm(g) && hasStatus(g, 'sent')).length,
    accepted: groups.filter((g) => inFirm(g) && hasStatus(g, 'accepted')).length,
    expired: groups.filter((g) => inFirm(g) && hasStatus(g, 'expired')).length,
  };

  const STATUS_TABS: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'accepted', label: 'Signed' },
    { key: 'expired', label: 'Expired' },
  ];

  /* Was: sum every recurring service's price, whatever its frequency, and
     ignore the Companies House fee entirely. An annual £50 Confirmation
     Statement was therefore reported as £50 a MONTH — twelve times over — and
     the CH disbursement never appeared at all. Both now come from the one
     shared calculation the letter uses. */
  const monthlyOf = (r: LinkRow) => feeTotals(r.services).monthly;

  /* A sole trader, partnership or individual has no company name — theirs is
     typed into the wizard and kept in letterMeta. Reading companyName alone
     rendered those clients as a blank row nobody could identify. */
  const nameOf = (r: LinkRow) =>
    r.companyName || r.clientName || r.directorName || r.clientEmail || "Untitled draft";

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
          {filteredGroups.map((g) => {
            const r = g.latest;
            const firm = r.firmSlug ? FIRMS[r.firmSlug] : null;
            const isDraft = r.status === 'draft';
            const st = STATUS[r.status] ?? STATUS.sent!;
            /* The fee the client AGREED, which is the signed one. Reading the
               newest link showed a fee from an unsigned draft — a number the
               client never put their name to. */
            const signed = signedOf(g);
            const feeRow = signed ?? r;
            const monthly = monthlyOf(feeRow);
            const pendingNewer = [g.latest, ...g.history].filter(
              (x) => x.status === 'sent' && !isSuperseded(x, signed) && x.id !== signed?.id,
            ).length;
            const resumeHref = `/onboarding/services?draft=${r.token}&firm=${r.firmSlug ?? 'gns'}`;
            const detailHref = isDraft ? resumeHref : `/staff/clients/${r.token}`;
            const expanded = openHistory === g.key;
            return (
              <div key={g.key} className="gns-reveal gns-press bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Link href={detailHref} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {/* The CLIENT's state, not the newest link's. */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${(signed ? STATUS.accepted! : st).cls}`}>
                      {signed ? STATUS.accepted!.label : st.label}
                    </span>
                    {signed && signed.acceptedAt && (
                      <span className="text-xs text-gray-400">
                        signed {new Date(signed.acceptedAt).toLocaleDateString('en-GB')}
                      </span>
                    )}
                    {signed && pendingNewer > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                        {pendingNewer} newer awaiting signature
                      </span>
                    )}
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
                    {monthly > 0 && (
                      <span className="text-xs text-gray-400" title="Our recurring fee, excluding VAT and any Companies House disbursement">
                        {gbp(monthly)}/month
                      </span>
                    )}
                    {feeTotals(feeRow.services).chAnnual > 0 && (
                      <span className="text-xs text-gray-400" title="Companies House disbursement — no VAT">
                        + {gbp(feeTotals(feeRow.services).chAnnual)}/yr CH
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                    {nameOf(r)}
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
                  <button onClick={() => del(r)} disabled={busy === r.id} className="p-2 text-gray-400 hover:text-amber-600" title="Archive client (nothing is deleted)">
                    <Trash2 size={15} />
                  </button>
                  <button onClick={() => hardDelete(r)} disabled={busy === r.id} className="p-2 text-gray-300 hover:text-red-600" title="Permanently delete (admin only) — destroys the record and its AML trail. Use Archive for real clients.">
                    <XOctagon size={15} />
                  </button>
                  <Link href={detailHref} className="p-2 text-gray-400 hover:text-gray-700">
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              {/* EVERY EARLIER ENGAGEMENT FOR THIS CLIENT.
                  These used to be dropped from the list entirely the moment a
                  newer one was raised — present in the database, invisible and
                  unreachable in the app. */}
              {g.history.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setOpenHistory(expanded ? null : g.key)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800"
                  >
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {g.history.length} earlier engagement{g.history.length === 1 ? '' : 's'}
                  </button>

                  {expanded && (
                    <div className="mt-2 space-y-1.5">
                      {g.history.map((h) => {
                        const hs = STATUS[h.status] ?? STATUS.sent!;
                        const spent = isSuperseded(h, signed);
                        const hDraft = h.status === 'draft';
                        const hHref = hDraft
                          ? `/onboarding/services?draft=${h.token}&firm=${h.firmSlug ?? 'gns'}`
                          : `/staff/clients/${h.token}`;
                        const hMonthly = monthlyOf(h);
                        return (
                          <div key={h.id} className="flex items-center justify-between gap-3 flex-wrap rounded-lg bg-gray-50 px-3 py-2">
                            <Link href={hHref} className="flex-1 min-w-0 group">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${spent ? 'bg-gray-100 text-gray-500' : hs.cls}`}>
                                  {spent ? 'Superseded' : hs.label}
                                </span>
                                <span className="text-xs text-gray-600 group-hover:text-blue-700">
                                  {h.sentAt ? new Date(h.sentAt).toLocaleDateString('en-GB') : '—'}
                                </span>
                                {hMonthly > 0 && <span className="text-xs text-gray-400">{gbp(hMonthly)}/month</span>}
                                {h.hasSignedLetter && <span className="text-[10px] text-green-700 font-semibold">signed letter</span>}
                              </div>
                            </Link>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => del(h)} disabled={busy === h.id}
                                className="p-1.5 text-gray-400 hover:text-amber-600" title="Archive this engagement">
                                <Trash2 size={13} />
                              </button>
                              <button onClick={() => hardDelete(h)} disabled={busy === h.id}
                                className="p-1.5 text-gray-300 hover:text-red-600" title="Delete this engagement permanently">
                                <XOctagon size={13} />
                              </button>
                              <Link href={hHref} className="p-1.5 text-gray-400 hover:text-gray-700"><ArrowRight size={14} /></Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
