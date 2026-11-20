'use client';

/**
 * Leads: every enquiry, from the website, the info@ inbox or the phone, in one
 * list, from first contact until it becomes a client or is closed.
 *
 * Website enquiries arrive by themselves (WordPress sends each WPForms
 * submission to /api/leads/inbound). The rest are added here with "Add lead".
 * When a lead agrees to become a client, "Start intake" opens the partner
 * intake form already filled in, so nothing is typed twice, and the lead
 * remembers which onboarding it became.
 *
 * Laid out as a list and a reading pane: the list answers "who needs a reply",
 * the pane is everything about one enquiry, editable in place.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Inbox, Plus, Search, Mail, Phone, Building2, ExternalLink, UserCheck,
  AlertTriangle, ArrowRight, Ban, RotateCcw, X, PlugZap,
} from 'lucide-react';
import { StatusPicker, LEAD_STATUS_OPTIONS } from '@/components/status-picker';
import { EMPTY_INTAKE, type IntakeForm } from '@/lib/intake';
import {
  LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS, type LeadSource, type LeadStatus,
} from '@/lib/lead-parse';
import type { Lead } from '@/lib/lead-store';

type View = 'open' | 'all' | LeadStatus;
type Counts = Record<LeadStatus, number> & { overdue: number; thisMonth: number };

const FIRMS: Record<string, string> = {
  gns: 'GNS Associates Ltd',
  llp: 'GNS Associates UK LLP',
  galaxy: 'Galaxy Accountants',
};

const ukDate = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** "3 hours ago", "yesterday", "12 Nov": how long someone has been waiting. */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return ukDate(iso);
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default function LeadsPage() {
  const [view, setView] = useState<View>('open');
  const [q, setQ] = useState('');
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [connected, setConnected] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads?view=${view}&q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(res.status === 401 ? 'You do not have access to leads.' : 'Could not load leads.');
      const j = await res.json();
      setLeads(j.leads);
      setCounts(j.counts);
      setConnected(Boolean(j.websiteConnected));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [view, q]);

  // Search waits for a pause in typing; changing the view loads at once.
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // New website enquiries appear without anyone pressing refresh.
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const selected = useMemo(() => leads?.find((l) => l.id === selectedId) ?? null, [leads, selectedId]);

  const replaceLead = (lead: Lead) =>
    setLeads((ls) => ls && ls.map((l) => (l.id === lead.id ? lead : l)));

  const tabs: Array<{ v: View; label: string; n?: number; tone?: string }> = [
    { v: 'open', label: 'Needs action', n: counts ? counts.new + counts.contacted + counts.meeting + counts.proposal : undefined },
    { v: 'new', label: 'New', n: counts?.new, tone: counts?.new ? 'text-blue-700' : undefined },
    { v: 'contacted', label: 'Contacted', n: counts?.contacted },
    { v: 'meeting', label: 'Meeting', n: counts?.meeting },
    { v: 'proposal', label: 'Quote sent', n: counts?.proposal },
    { v: 'won', label: 'Won', n: counts?.won },
    { v: 'lost', label: 'Lost', n: counts?.lost },
    { v: 'spam', label: 'Spam', n: counts?.spam },
    { v: 'all', label: 'All' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-5 py-5 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox size={22} className="text-blue-600" /> Leads
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enquiries from the website, info@, the phone and referrals.
            {counts && <> {counts.thisMonth} this month{counts.overdue > 0 && <> · <span className="text-red-700 font-medium">{counts.overdue} follow-up{counts.overdue === 1 ? '' : 's'} overdue</span></>}</>}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus size={16} /> Add lead
        </button>
      </header>

      {!connected && <ConnectBanner />}

      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.v}
            onClick={() => { setView(t.v); setSelectedId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              view === t.v ? 'bg-gray-900 border-gray-900 text-white' : `bg-white border-gray-200 hover:border-gray-400 ${t.tone ?? 'text-gray-600'}`
            }`}
          >
            {t.label}{t.n !== undefined && <span className="ml-1 opacity-70">{t.n}</span>}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, company…"
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4 items-start">
        <LeadList leads={leads} selectedId={selectedId} onSelect={setSelectedId} view={view} />
        {selected
          ? <LeadPane key={selected.id} lead={selected} onChange={replaceLead} onReload={load} onClose={() => setSelectedId(null)} />
          : <div className="hidden lg:block border border-dashed border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">Pick a lead to read and update it.</div>}
      </div>

      {adding && <AddLead onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); setView('open'); setSelectedId(id); load(); }} />}
    </div>
  );
}

function LeadList({ leads, selectedId, onSelect, view }: {
  leads: Lead[] | null; selectedId: string | null; onSelect: (id: string) => void; view: View;
}) {
  if (!leads) return <div className="text-sm text-gray-500 p-4">Loading leads…</div>;
  if (!leads.length) {
    return (
      <div className="border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
        {view === 'open' ? 'Nothing waiting. New website enquiries will appear here by themselves.' : 'No leads here.'}
      </div>
    );
  }
  const today = todayIso();
  return (
    <ul className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white">
      {leads.map((l) => {
        const overdue = l.nextActionOn && l.nextActionOn < today && ['new', 'contacted', 'meeting', 'proposal'].includes(l.status);
        return (
          <li key={l.id}>
            <button
              onClick={() => onSelect(l.id)}
              className={`w-full text-left px-4 py-2.5 transition-colors ${selectedId === l.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                    {l.status === 'new' && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="New" />}
                    {l.companyName || l.name || l.email || 'Unnamed enquiry'}
                    {l.companyName && l.name && <span className="font-normal text-gray-500 truncate">· {l.name}</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {l.services || (l.message ?? '').slice(0, 90) || l.email || l.phone}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-gray-400">{ago(l.receivedAt)}</div>
                  <div className="text-[11px] font-medium text-gray-600">{LEAD_STATUS_LABELS[l.status]}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 text-[11px] text-gray-400 mt-0.5">
                <span>{l.source === 'website' && l.formName ? l.formName : LEAD_SOURCE_LABELS[l.source]}</span>
                {l.ownerName && <span>· {l.ownerName}</span>}
                {l.nextActionOn && (
                  <span className={overdue ? 'text-red-700 font-medium' : ''}>· follow up {ukDate(l.nextActionOn)}</span>
                )}
                {l.previousEnquiries > 0 && <span className="text-amber-700">· enquired before</span>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function LeadPane({ lead, onChange, onReload, onClose }: {
  lead: Lead; onChange: (l: Lead) => void; onReload: () => void; onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string>('');
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [lostReason, setLostReason] = useState(lead.lostReason ?? '');
  const [converting, setConverting] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const patch = async (body: Record<string, unknown>, reload = false) => {
    setSaving('saving…');
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      if (j.lead) onChange(j.lead);
      setSaving('saved');
      // A status change can move the lead out of the current view.
      if (reload) onReload();
    } catch {
      setSaving('could not save');
    }
    setTimeout(() => setSaving(''), 2500);
  };

  /** Save the client from the lead, then open the engagement wizard on it (the partner intake form is switched off for now). */
  const startIntake = async () => {
    setConverting(true);
    const intake: IntakeForm = {
      ...EMPTY_INTAKE,
      filledByRole: 'staff',
      clientName: lead.companyName || lead.name || '',
      companyNumber: lead.companyNumber ?? '',
      firmSlug: lead.firmSlug ?? 'gns',
      servicesSold: lead.services ?? '',
      contact: {
        name: lead.name ?? '',
        email: lead.email ?? '',
        mobile: lead.phone ?? '',
        preferred: lead.email ? 'email' : 'phone',
      },
    };
    try {
      const res = await fetch('/api/onboarding/intake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intake }),
      });
      const j = await res.json();
      if (!res.ok || !j.token) throw new Error(j.error ?? 'Could not start the intake.');
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeToken: j.token, status: 'won' }),
      });
      router.push(`/onboarding/services?draft=${j.token}&firm=${intake.firmSlug}`);
    } catch (e) {
      setConverting(false);
      setSaving((e as Error).message);
    }
  };

  const reply = lead.email
    ? `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent('Your enquiry to ' + (FIRMS[lead.firmSlug ?? 'gns'] ?? 'GNS Associates'))}`
    : null;

  return (
    <section className="border border-gray-200 rounded-xl bg-white overflow-hidden lg:sticky lg:top-4">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{lead.companyName || lead.name || 'Unnamed enquiry'}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {lead.source === 'website' && lead.formName ? `${lead.formName} form` : LEAD_SOURCE_LABELS[lead.source]}
            {' · '}{ukDate(lead.receivedAt)} ({ago(lead.receivedAt)})
            {lead.pageUrl && <> · <a href={lead.pageUrl} target="_blank" rel="noreferrer" className="underline hover:text-gray-700">page</a></>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <span className="text-[11px] text-gray-400">{saving}</span>}
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {lead.status === 'spam' && (
          <div className="text-xs bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span>Filed as spam{lead.spamReason ? `: ${lead.spamReason}` : ''}.</span>
            <button onClick={() => patch({ status: 'new' }, true)} className="flex items-center gap-1 font-semibold text-blue-700 hover:underline">
              <RotateCcw size={12} /> Not spam
            </button>
          </div>
        )}
        {lead.previousEnquiries > 0 && (
          <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
            This person has enquired {lead.previousEnquiries === 1 ? 'once' : `${lead.previousEnquiries} times`} before. Search their email to see the earlier ones.
          </p>
        )}

        {/* Who they are and how to reach them, each one click away. */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {lead.name && <><dt className="text-gray-400">Name</dt><dd className="text-gray-900">{lead.name}</dd></>}
          {lead.email && (
            <><dt className="text-gray-400"><Mail size={14} className="inline" /></dt>
            <dd><a href={reply ?? '#'} className="text-blue-700 hover:underline break-all">{lead.email}</a></dd></>
          )}
          {lead.phone && (
            <><dt className="text-gray-400"><Phone size={14} className="inline" /></dt>
            <dd><a href={`tel:${lead.phone}`} className="text-blue-700 hover:underline">{lead.phone}</a></dd></>
          )}
          {(lead.companyName || lead.companyNumber) && (
            <><dt className="text-gray-400"><Building2 size={14} className="inline" /></dt>
            <dd className="text-gray-900">
              {lead.companyName}
              {lead.companyNumber && (
                <> · <a href={`https://find-and-update.company-information.service.gov.uk/company/${lead.companyNumber}`}
                        target="_blank" rel="noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-0.5">
                  {lead.companyNumber} <ExternalLink size={11} />
                </a></>
              )}
            </dd></>
          )}
          {lead.services && <><dt className="text-gray-400">Wants</dt><dd className="text-gray-900 whitespace-pre-line">{lead.services}</dd></>}
          {lead.extra.map((x, i) => (
            <Fragment key={i}>
              <dt className="text-gray-400">{x.label}</dt>
              <dd className="text-gray-900 whitespace-pre-line">{x.value}</dd>
            </Fragment>
          ))}
        </dl>

        {lead.message && (
          <blockquote className="text-sm text-gray-800 bg-gray-50 border-l-4 border-gray-300 rounded-r-lg px-4 py-3 whitespace-pre-line">
            {lead.message}
          </blockquote>
        )}

        {lead.status !== 'spam' && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</p>
            <StatusPicker
              value={lead.status as Exclude<LeadStatus, 'spam'>}
              options={LEAD_STATUS_OPTIONS}
              compact={false}
              busy={saving === 'saving…'}
              onPick={(s) => patch(
                // A reply sent means the next look is in a few days, unless someone already set one.
                s === 'contacted' && !lead.nextActionOn ? { status: s, nextActionOn: plusDays(3) } : { status: s },
                true,
              )}
            />
          </div>
        )}

        {lead.status === 'lost' && (
          <label className="block text-sm">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Why it was lost</span>
            <input
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              onBlur={() => lostReason !== (lead.lostReason ?? '') && patch({ lostReason: lostReason || null })}
              placeholder="Price, chose another firm, no reply, not a fit…"
              className="mt-1 w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
            />
          </label>
        )}

        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Who has it</p>
            {lead.ownerName
              ? <p className="flex items-center gap-2">{lead.ownerName}
                  <button onClick={() => patch({ takeOwnership: false })} className="text-[11px] text-gray-400 hover:text-gray-700 underline">release</button></p>
              : <button onClick={() => patch({ takeOwnership: true })} className="flex items-center gap-1 text-blue-700 font-semibold hover:underline">
                  <UserCheck size={14} /> I&apos;ll take it
                </button>}
          </div>
          <label>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Follow up on</span>
            <input
              type="date"
              value={lead.nextActionOn ?? ''}
              onChange={(e) => patch({ nextActionOn: e.target.value || null }, true)}
              className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            />
          </label>
          <label>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Firm</span>
            <select
              value={lead.firmSlug ?? ''}
              onChange={(e) => patch({ firmSlug: e.target.value || null })}
              className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Not decided</option>
              {Object.entries(FIRMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (lead.notes ?? '') && patch({ notes: notes || null })}
            rows={3}
            placeholder="Called 15 Nov, wants a quote for accounts + payroll for 6 staff. Send by Friday."
            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
          {reply && (
            <a href={reply} className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:border-gray-400">
              <Mail size={14} /> Reply by email
            </a>
          )}
          {lead.intakeToken ? (
            <Link href={`/onboarding/services?draft=${lead.intakeToken}&firm=${lead.firmSlug ?? 'gns'}`}
                  className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700">
              Open the onboarding <ArrowRight size={14} />
            </Link>
          ) : lead.status !== 'spam' && (
            <button onClick={startIntake} disabled={converting}
                    title="They have agreed to become a client: open the engagement wizard filled in from this enquiry"
                    className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}>
              {converting ? 'Opening…' : <>Start onboarding <ArrowRight size={14} /></>}
            </button>
          )}
          {lead.status !== 'spam' && !lead.intakeToken && (
            <button onClick={() => patch({ status: 'spam' }, true)}
                    className="mt-3 ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-700">
              <Ban size={13} /> Spam
            </button>
          )}
        </div>
        {lead.status !== 'spam' && <DraftReply lead={lead} onSaved={() => setHistoryKey((k) => k + 1)} />}
        <LeadHistory key={historyKey} lead={lead} onStatusChanged={onReload} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Draft reply: check the website quote, then save a reply to Drafts   */
/* ------------------------------------------------------------------ */

interface QuoteLine { label: string; quoted: number; current: number | null; ok: boolean | null; note?: string }
interface DraftResponse {
  draft: { subject: string; html: string; text: string; check: { found: boolean; lines: QuoteLine[]; quotedTotal: number | null; currentTotal: number; customQuote: boolean; issues: string[] } };
  mailbox: string;
  mailto: string | null;
  saved?: { saved: true; mailbox: string; webLink: string | null } | { saved: false; mailbox: string; reason: string; detail?: string };
  error?: string;
}

const gbpUi = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');

function DraftReply({ lead, onSaved }: { lead: Lead; onSaved: () => void }) {
  const [res, setRes] = useState<DraftResponse | null>(null);
  const [busy, setBusy] = useState<null | 'preview' | 'save'>(null);
  const [copied, setCopied] = useState(false);

  const call = async (save: boolean) => {
    setBusy(save ? 'save' : 'preview');
    try {
      const r = await fetch(`/api/leads/${lead.id}/draft`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ save }),
      });
      const j = (await r.json()) as DraftResponse;
      setRes(j);
      if (j.saved?.saved) onSaved();
    } catch {
      setRes({ error: 'Could not prepare the draft.' } as DraftResponse);
    }
    setBusy(null);
  };

  if (!res) {
    return (
      <div className="pt-3 border-t border-gray-100">
        <button onClick={() => call(false)} disabled={busy !== null || !lead.email}
                title={lead.email ? 'Check the quote against today\'s prices and write a reply' : 'No email address to reply to'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50">
          <Mail size={14} /> {busy ? 'Preparing…' : 'Draft reply'}
        </button>
      </div>
    );
  }
  if (res.error || !res.draft) return <p className="text-sm text-red-700 pt-3 border-t border-gray-100">{res.error ?? 'Could not prepare the draft.'}</p>;

  const c = res.draft.check;
  return (
    <div className="pt-3 border-t border-gray-100 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Draft reply</p>
        <button onClick={() => setRes(null)} className="text-gray-400 hover:text-gray-700"><X size={14} /></button>
      </div>

      {c.found && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <p className={`text-xs font-semibold px-3 py-1.5 ${c.issues.length ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-900'}`}>
            {c.issues.length ? 'Quote checked: some figures differ from today\'s website prices. The draft uses today\'s prices.' : 'Quote checked: matches today\'s website prices.'}
          </p>
          <table className="w-full text-xs">
            <thead><tr className="text-gray-400"><th className="text-left font-medium px-3 py-1">Line</th><th className="text-right font-medium px-2">Quoted</th><th className="text-right font-medium px-3">Today</th></tr></thead>
            <tbody>
              {c.lines.map((l, i) => (
                <tr key={i} className={l.ok === false ? 'bg-amber-50' : ''}>
                  <td className="px-3 py-1 text-gray-800">{l.label}{l.note && <div className="text-[11px] text-amber-800">{l.note}</div>}</td>
                  <td className="px-2 text-right tabular-nums">{gbpUi(l.quoted)}</td>
                  <td className="px-3 text-right tabular-nums">{l.current === null ? <span className="text-gray-400">n/a</span> : gbpUi(l.current)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 font-semibold">
                <td className="px-3 py-1">Total (excl. VAT)</td>
                <td className="px-2 text-right tabular-nums">{c.quotedTotal === null ? '' : gbpUi(c.quotedTotal)}</td>
                <td className="px-3 text-right tabular-nums">{gbpUi(c.currentTotal)}</td>
              </tr>
            </tbody>
          </table>
          {c.issues.length > 0 && (
            <ul className="text-[11px] text-amber-900 px-3 py-2 list-disc list-inside bg-amber-50/50">{c.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
          )}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-500 px-3 py-1.5 border-b border-gray-100">To {lead.email} · <b className="text-gray-700">{res.draft.subject}</b></p>
        {/* Our own template with every client value escaped on the server. */}
        <div className="px-3 py-2 text-sm max-h-72 overflow-y-auto" dangerouslySetInnerHTML={{ __html: res.draft.html }} />
      </div>

      {res.saved?.saved ? (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Saved in the Drafts folder of {res.saved.mailbox}. Nothing has been sent. Open Outlook, check it, and press Send.
          {res.saved.webLink && <> <a href={res.saved.webLink} target="_blank" rel="noreferrer" className="underline font-semibold">Open the draft</a></>}
        </p>
      ) : (
        <>
          {res.saved && !res.saved.saved && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {res.saved.reason === 'not_granted'
                ? 'Could not save to Outlook: the platform does not have permission to write drafts yet (Microsoft Graph Mail.ReadWrite). Copy the text below, or open it in your mail app.'
                : 'Could not save to Outlook. Copy the text below, or open it in your mail app.'}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => call(true)} disabled={busy !== null}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
              {busy === 'save' ? 'Saving…' : `Save to Outlook drafts (${res.mailbox})`}
            </button>
            <button onClick={async () => { await navigator.clipboard.writeText(res.draft.text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:border-gray-400">
              {copied ? 'Copied' : 'Copy text'}
            </button>
            {res.mailto && <a href={res.mailto} className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:border-gray-400">Open in mail app</a>}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History: emails with any GNS mailbox, logged contact, changes       */
/* ------------------------------------------------------------------ */

interface HistEmail {
  key: string; direction: 'in' | 'out'; at: string; subject: string; fromName: string | null; fromAddress: string | null;
  to: string[]; preview: string; mailboxes: string[]; webLink: string | null; attachments: string[]; hasAttachments: boolean;
  isQuote: boolean; source: 'mailbox' | 'app';
}
interface HistEvent { id: string; at: string; actorName: string | null; kind: string; channel?: string; direction?: 'in' | 'out'; text: string }
interface HistResponse {
  events: HistEvent[];
  mail: { emails: HistEmail[]; access: 'ok' | 'not_configured' | 'not_granted' | 'partial' | 'error'; mailboxesSearched: number; skipped: string[]; searchedFor: string | null };
  statusChanged: boolean;
}

const CHANNELS: Record<string, string> = { whatsapp: 'WhatsApp', phone: 'Phone call', meeting: 'Meeting', sms: 'Text message', email: 'Email (other)', other: 'Other' };
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function LeadHistory({ lead, onStatusChanged }: { lead: Lead; onStatusChanged: () => void }) {
  const [data, setData] = useState<HistResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'email' | 'contact' | 'changes'>('all');

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/leads/${lead.id}/history${fresh ? '?fresh=1' : ''}`);
      if (!r.ok) throw new Error();
      const j = (await r.json()) as HistResponse;
      setData(j);
      setErr(null);
      if (j.statusChanged) onStatusChanged();
    } catch {
      setErr('Could not load the history.');
    }
    setLoading(false);
  }, [lead.id, onStatusChanged]);

  useEffect(() => { load(); }, [load]);

  type Item = { at: string; kind: 'email'; e: HistEmail } | { at: string; kind: 'event'; ev: HistEvent };
  const items: Item[] = useMemo(() => {
    if (!data) return [];
    const all: Item[] = [
      ...data.mail.emails.map((e) => ({ at: e.at, kind: 'email' as const, e })),
      ...data.events.map((ev) => ({ at: ev.at, kind: 'event' as const, ev })),
    ];
    return all
      .filter((i) => filter === 'all'
        || (filter === 'email' && i.kind === 'email')
        || (filter === 'contact' && i.kind === 'event' && i.ev.kind === 'contact')
        || (filter === 'changes' && i.kind === 'event' && i.ev.kind !== 'contact'))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [data, filter]);

  const removeContact = async (id: string) => {
    if (!confirm('Remove this contact note?')) return;
    await fetch(`/api/leads/${lead.id}/history?eventId=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="pt-3 border-t border-gray-100 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">History</p>
        <div className="flex items-center gap-1">
          {(['all', 'email', 'contact', 'changes'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${filter === f ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
              {f === 'all' ? 'All' : f === 'email' ? 'Emails' : f === 'contact' ? 'Calls & WhatsApp' : 'Changes'}
            </button>
          ))}
          <button onClick={() => load(true)} disabled={loading} title="Search the mailboxes again"
                  className="ml-1 text-gray-400 hover:text-gray-700 disabled:opacity-40"><RotateCcw size={13} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <LogContact leadId={lead.id} onLogged={() => load()} />

      {data && data.mail.searchedFor && data.mail.access !== 'ok' && (
        <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          {data.mail.access === 'not_granted' && 'Emails are not shown yet: the platform has not been given permission to read GNS mailboxes (Microsoft Graph Mail.Read). Calls, WhatsApp and changes are shown.'}
          {data.mail.access === 'not_configured' && 'Emails are not shown: the Microsoft 365 connection is not set up on the server.'}
          {data.mail.access === 'partial' && `Searched ${data.mail.mailboxesSearched} mailboxes; could not read ${data.mail.skipped.join(', ')}.`}
          {data.mail.access === 'error' && 'The mailboxes could not be searched just now. Try the refresh button.'}
        </p>
      )}
      {data && !data.mail.searchedFor && lead.email === null && (
        <p className="text-[11px] text-gray-400">No email address on this lead, so there are no emails to find.</p>
      )}
      {err && <p className="text-xs text-red-700">{err}</p>}
      {!data && !err && <p className="text-xs text-gray-400">Searching GNS mailboxes…</p>}
      {data && !items.length && <p className="text-xs text-gray-400">Nothing yet.</p>}

      <ol className="space-y-2">
        {items.map((i) => i.kind === 'email' ? (
          <li key={'e' + i.e.key} className={`rounded-lg border px-3 py-2 ${i.e.direction === 'in' ? 'border-gray-200 bg-white' : 'border-blue-100 bg-blue-50/40'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  {i.e.direction === 'in' ? '← Received from client' : `→ Sent by ${i.e.fromName ?? i.e.fromAddress ?? 'GNS'}`}
                  {i.e.isQuote && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px] font-bold">QUOTE</span>}
                </p>
                <p className="text-sm font-semibold text-gray-900 truncate">{i.e.subject}</p>
              </div>
              <span className="text-[11px] text-gray-400 shrink-0">{when(i.e.at)}</span>
            </div>
            {i.e.preview && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{i.e.preview}</p>}
            <p className="text-[11px] text-gray-400 mt-1">
              {i.e.attachments.length > 0 && <>📎 {i.e.attachments.join(', ')} · </>}
              {i.e.attachments.length === 0 && i.e.hasAttachments && <>📎 attachments · </>}
              {i.e.mailboxes.length > 0 ? <>in {i.e.mailboxes.join(', ')}</> : 'sent by the platform'}
              {i.e.webLink && <> · <a href={i.e.webLink} target="_blank" rel="noreferrer" className="underline hover:text-gray-700">open in Outlook</a></>}
            </p>
          </li>
        ) : i.ev.kind === 'contact' ? (
          <li key={'v' + i.ev.id} className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-gray-500">
                {i.ev.direction === 'in' ? '← ' : '→ '}{CHANNELS[i.ev.channel ?? 'other'] ?? 'Contact'}
                {i.ev.direction === 'in' ? ' from client' : ' to client'}
                {i.ev.actorName && <> · logged by {i.ev.actorName}</>}
              </p>
              <span className="text-[11px] text-gray-400 shrink-0 flex items-center gap-1">
                {when(i.ev.at)}
                <button onClick={() => removeContact(i.ev.id)} title="Remove" className="text-gray-300 hover:text-red-600"><X size={11} /></button>
              </span>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-line mt-0.5">{i.ev.text}</p>
          </li>
        ) : (
          <li key={'v' + i.ev.id} className="text-[11px] text-gray-500 px-1 flex justify-between gap-2">
            <span>{i.ev.text}{i.ev.actorName && <> · {i.ev.actorName}</>}</span>
            <span className="text-gray-400 shrink-0">{when(i.ev.at)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LogContact({ leadId, onLogged }: { leadId: string; onLogged: () => void }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState('whatsapp');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [at, setAt] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!text.trim()) { setErr('Write what was said.'); return; }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, direction, text, ...(at ? { at: new Date(at).toISOString() } : {}) }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Could not save.');
      setText(''); setAt(''); setOpen(false);
      onLogged();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline">
        <Plus size={14} /> Log a call, WhatsApp or meeting
      </button>
    );
  }
  const input = 'px-2 py-1 border border-gray-200 rounded-lg text-sm bg-white';
  return (
    <div className="border border-emerald-200 rounded-lg p-3 space-y-2 bg-emerald-50/30">
      <div className="flex flex-wrap gap-2">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={input}>
          {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={direction} onChange={(e) => setDirection(e.target.value as 'in' | 'out')} className={input}>
          <option value="out">We contacted them</option>
          <option value="in">They contacted us</option>
        </select>
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} max={new Date().toISOString().slice(0, 16)}
               title="When it happened (leave blank for now)" className={input} />
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus
                placeholder="e.g. Sent the quote on WhatsApp; they will confirm by Friday. Wants payroll for 6 staff added."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400" />
      {err && <p className="text-xs text-red-700">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={() => { setOpen(false); setErr(null); }} className="px-3 py-1.5 text-sm text-gray-600">Cancel</button>
        <button onClick={save} disabled={busy} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function AddLead({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const [f, setF] = useState({
    source: 'phone' as Exclude<LeadSource, 'website'>, name: '', email: '', phone: '',
    companyName: '', companyNumber: '', services: '', message: '', firmSlug: 'gns',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(typeof j.error === 'string' && j.error !== 'bad_request' ? j.error : 'Check the details and try again.');
      onAdded(j.id);
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400';
  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl w-full max-w-lg mt-12 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Add a lead</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500">For enquiries the website did not catch: a call, an email to info@, a referral.</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-500">How they came in
            <select value={f.source} onChange={set('source')} className={input + ' bg-white mt-1'}>
              {(['phone', 'email', 'referral', 'walk_in', 'other'] as const).map((s) => (
                <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-500">Firm
            <select value={f.firmSlug} onChange={set('firmSlug')} className={input + ' bg-white mt-1'}>
              {Object.entries(FIRMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">Name<input value={f.name} onChange={set('name')} className={input + ' mt-1'} autoFocus /></label>
          <label className="text-xs text-gray-500">Company<input value={f.companyName} onChange={set('companyName')} className={input + ' mt-1'} /></label>
          <label className="text-xs text-gray-500">Email<input type="email" value={f.email} onChange={set('email')} className={input + ' mt-1'} /></label>
          <label className="text-xs text-gray-500">Phone<input value={f.phone} onChange={set('phone')} className={input + ' mt-1'} /></label>
          <label className="text-xs text-gray-500">Company number<input value={f.companyNumber} onChange={set('companyNumber')} className={input + ' mt-1'} /></label>
          <label className="text-xs text-gray-500">Services wanted<input value={f.services} onChange={set('services')} placeholder="Accounts, VAT, payroll…" className={input + ' mt-1'} /></label>
        </div>
        <label className="block text-xs text-gray-500">What they said
          <textarea value={f.message} onChange={set('message')} rows={3} className={input + ' mt-1'} />
        </label>

        {err && <p className="text-sm text-red-700 flex items-center gap-1"><AlertTriangle size={14} /> {err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            {busy ? 'Saving…' : 'Add lead'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Shown until the server has a webhook secret: the website cannot send leads yet. */
function ConnectBanner() {
  return (
    <div className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 flex items-start gap-2">
      <PlugZap size={16} className="mt-0.5 shrink-0" />
      <div>
        <b>The website is not connected yet.</b> Leads can be added by hand now. To have WPForms enquiries arrive here
        automatically, set <code className="text-xs bg-amber-100 px-1 rounded">LEADS_WEBHOOK_SECRET</code> on the server and
        install the GNS Leads Bridge plugin on WordPress (setup steps: <code className="text-xs bg-amber-100 px-1 rounded">docs/wordpress/README.md</code>).
      </div>
    </div>
  );
}
