'use client';

/**
 * CRM: the platform's copy of everything in the GNS CRM (crm.gnsuk.com).
 *
 * The top says whether the CRM is connected and how the last sync went; "Sync
 * now" pulls it again, in small steps, showing progress. The list can be
 * narrowed to the questions people actually ask: which CRM companies are not
 * matched to a client here, whose director ID verification is due in the next
 * 30 days, what failed to load, and what the CRM no longer lists. Choosing a
 * company shows its full CRM record: profile, people and all 13 datasets.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Database, RefreshCw, Search, AlertTriangle, CheckCircle2, X, ExternalLink } from 'lucide-react';
import { CRM_DATASETS, CRM_DATASET_LABELS } from '@/lib/crm-shape';
import type { SyncRun, CrmCompanyRow, CrmView } from '@/lib/crm-sync';

type Counts = Record<CrmView, number>;
type Detail = CrmCompanyRow & { profile: Record<string, unknown>; datasets: Record<string, Array<Record<string, unknown>>>; people: Array<{ name: string; kind: string; role: string | null; current: boolean; verificationDue: string | null; verifiedOn: string | null }> };

const VIEWS: Array<{ v: CrmView; label: string }> = [
  { v: 'all', label: 'All companies' },
  { v: 'unmatched', label: 'Not matched to a client' },
  { v: 'verification', label: 'ID verification due ≤ 30 days' },
  { v: 'problems', label: 'Could not load' },
  { v: 'gone', label: 'No longer in CRM' },
];

const uk = (d: string | null) => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const ukTime = (d: string | null) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const daysTo = (d: string | null) => (d ? Math.round((Date.parse(d + 'T00:00:00') - Date.now()) / 86400000) : null);

export default function CrmPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [view, setView] = useState<CrmView>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CrmCompanyRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const stopRef = useRef(false);

  const loadStatus = useCallback(async () => {
    const r = await fetch('/api/crm/sync');
    if (!r.ok) { setErr(r.status === 401 ? 'You do not have access to this page.' : 'Could not load the CRM status.'); return; }
    const j = await r.json();
    setConfigured(j.configured); setRuns(j.runs); setCounts(j.counts);
  }, []);

  const loadList = useCallback(async () => {
    const r = await fetch(`/api/crm/companies?view=${view}&q=${encodeURIComponent(q)}`);
    if (r.ok) setRows((await r.json()).companies);
  }, [view, q]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { const t = setTimeout(loadList, q ? 300 : 0); return () => clearTimeout(t); }, [loadList, q]);
  useEffect(() => () => { stopRef.current = true; }, []);

  const active = runs.find((r) => r.status === 'listing' || r.status === 'details') ?? null;
  const last = runs[0] ?? null;

  /** Start (or resume) and keep stepping until done, refreshing as it goes. */
  const sync = async () => {
    setSyncing(true); setErr(null); stopRef.current = false;
    try {
      let r = await fetch('/api/crm/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) });
      let j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Could not start the sync.');
      let run: SyncRun = j.run;
      while (!stopRef.current && (run.status === 'listing' || run.status === 'details')) {
        r = await fetch('/api/crm/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'step', runId: run.id }) });
        j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'The sync stopped.');
        run = j.run;
        setRuns((rs) => [run, ...rs.filter((x) => x.id !== run.id)]);
        if (run.message && run.status !== 'failed') await new Promise((res) => setTimeout(res, 3000));
      }
      if (run.status === 'failed') setErr(run.message ?? 'The sync failed.');
    } catch (e) {
      setErr((e as Error).message);
    }
    setSyncing(false);
    loadStatus(); loadList();
  };

  return (
    <div className="max-w-7xl mx-auto px-5 py-5 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Database size={22} className="text-blue-600" /> CRM</h1>
          <p className="text-sm text-gray-500 mt-1">Company records, directors, PSCs and filings from the GNS CRM (crm.gnsuk.com). Read-only: nothing here changes the CRM.</p>
        </div>
        <button onClick={sync} disabled={syncing || configured === false}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : active ? 'Resume sync' : 'Sync now'}
        </button>
      </header>

      {configured === false && (
        <div className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div><b>The CRM is not connected yet.</b> Add <code className="text-xs bg-amber-100 px-1 rounded">CRM_API_KEY</code> (the full token from the CRM, including the part before the |) in cPanel → Setup Node.js App → Environment variables, then restart the app.</div>
        </div>
      )}
      {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

      <RunStatus run={active ?? last} syncing={syncing} />

      <div className="flex flex-wrap items-center gap-1.5">
        {VIEWS.map((t) => (
          <button key={t.v} onClick={() => { setView(t.v); setSelected(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${view === t.v ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            {t.label}{counts && <span className="ml-1 opacity-70">{counts[t.v]}</span>}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company, client or number…"
                 className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:border-gray-400" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 items-start">
        <CompanyList rows={rows} selected={selected} onSelect={setSelected} view={view} />
        {selected ? <CompanyPane id={selected} onClose={() => setSelected(null)} /> :
          <div className="hidden lg:block border border-dashed border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">Pick a company to see its full CRM record.</div>}
      </div>
    </div>
  );
}

function RunStatus({ run, syncing }: { run: SyncRun | null; syncing: boolean }) {
  if (!run) return <p className="text-sm text-gray-500">No sync has run yet.</p>;
  const running = run.status === 'listing' || run.status === 'details';
  const pct = run.total ? Math.min(100, Math.round(((run.detailed + run.failed) / run.total) * 100)) : null;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${run.status === 'failed' ? 'border-red-200 bg-red-50' : running ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-white'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold flex items-center gap-1.5">
          {run.status === 'done' && <CheckCircle2 size={15} className="text-green-600" />}
          {run.status === 'failed' && <AlertTriangle size={15} className="text-red-600" />}
          {run.status === 'done' ? `Last sync finished ${ukTime(run.finishedAt)}` :
           run.status === 'failed' ? 'Last sync failed' :
           run.status === 'listing' ? `Reading the company list (page ${run.listPage}${run.listLast ? ` of ${run.listLast}` : ''})` :
           `Loading companies: ${run.detailed + run.failed} of ${run.total ?? run.listed}${pct !== null ? ` (${pct}%)` : ''}`}
        </span>
        <span className="text-gray-500">{run.listed} listed · {run.detailed} loaded · {run.matched} matched to clients · {run.peopleLinked} people linked{run.failed ? ` · ${run.failed} could not load` : ''}</span>
        <span className="text-gray-400 text-xs">started {ukTime(run.startedAt)} {run.trigger === 'cron' ? '(nightly)' : run.startedBy ? `by ${run.startedBy}` : ''}</span>
      </div>
      {running && pct !== null && <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} /></div>}
      {running && !syncing && <p className="text-xs text-gray-500 mt-1">Paused. Press Resume sync, or the nightly run will carry on.</p>}
      {run.message && <p className={`text-xs mt-1 ${run.status === 'failed' ? 'text-red-800' : 'text-amber-800'}`}>{run.message}</p>}
    </div>
  );
}

function CompanyList({ rows, selected, onSelect, view }: { rows: CrmCompanyRow[] | null; selected: string | null; onSelect: (id: string) => void; view: CrmView }) {
  if (!rows) return <p className="text-sm text-gray-500 p-4">Loading…</p>;
  if (!rows.length) return <div className="border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">{view === 'all' ? 'Nothing synced yet. Press Sync now.' : 'None.'}</div>;
  return (
    <ul className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white">
      {rows.map((c) => {
        const due = daysTo(c.nextVerificationDue);
        return (
          <li key={c.crmId}>
            <button onClick={() => onSelect(c.crmId)} className={`w-full text-left px-4 py-2.5 ${selected === c.crmId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.companyName ?? c.clientName ?? `CRM #${c.crmId}`}</p>
                  <p className="text-xs text-gray-500 truncate">{c.companyNumber ?? 'no company number'}{c.chStatus && ` · ${c.chStatus}`}{c.accountsDue && ` · accounts due ${uk(c.accountsDue)}`}</p>
                </div>
                <div className="text-right shrink-0 text-[11px]">
                  {c.matchedTokens.length ? <span className="text-green-700 font-semibold">matched</span> : <span className="text-gray-400">not matched</span>}
                  {due !== null && <div className={due < 0 ? 'text-red-700 font-semibold' : due <= 30 ? 'text-amber-700 font-semibold' : 'text-gray-400'}>ID due {uk(c.nextVerificationDue)}</div>}
                  {c.detailError && <div className="text-red-700">could not load</div>}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CompanyPane({ id, onClose }: { id: string; onClose: () => void }) {
  const [c, setC] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>('directors');

  useEffect(() => {
    setC(null); setErr(null);
    fetch(`/api/crm/companies?id=${encodeURIComponent(id)}`).then(async (r) => {
      if (!r.ok) throw new Error();
      setC((await r.json()).company);
    }).catch(() => setErr('Could not load this company.'));
  }, [id]);

  if (err) return <p className="text-sm text-red-700">{err}</p>;
  if (!c) return <p className="text-sm text-gray-500">Loading…</p>;

  const profileRows = Object.entries(c.profile).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object');
  return (
    <section className="border border-gray-200 rounded-xl bg-white overflow-hidden lg:sticky lg:top-4 max-h-[85vh] overflow-y-auto">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900">{c.companyName ?? c.clientName ?? `CRM #${c.crmId}`}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            CRM #{c.crmId}{c.companyNumber && <> · <a href={`https://find-and-update.company-information.service.gov.uk/company/${c.companyNumber}`} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-0.5">{c.companyNumber} <ExternalLink size={10} /></a></>}
            {c.syncedAt && <> · synced {ukTime(c.syncedAt)}</>}
            {c.gone && <span className="text-red-700"> · no longer in the CRM</span>}
          </p>
          <p className="text-xs mt-1">
            {c.matchedTokens.length
              ? c.matchedTokens.map((t, i) => <Link key={t} href={`/staff/clients/${t}`} className="text-green-700 font-semibold hover:underline mr-2">Open client{c.matchedTokens.length > 1 ? ` ${i + 1}` : ''} →</Link>)
              : <span className="text-gray-500">Not matched to a client here (no client with company number {c.companyNumber ?? '—'}).</span>}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
      </div>

      <div className="px-5 py-4 space-y-4 text-sm">
        {c.detailError && <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Last load failed: {c.detailError}</p>}

        <div className="grid grid-cols-3 gap-3 text-xs">
          {[['Accounts due', c.accountsDue], ['Confirmation statement due', c.confirmationDue], ['Next ID verification due', c.nextVerificationDue]].map(([l, d]) => {
            const n = daysTo(d as string | null);
            return <div key={l as string} className="border border-gray-200 rounded-lg px-3 py-2"><p className="text-gray-400">{l}</p><p className={`font-semibold ${n !== null && n < 0 ? 'text-red-700' : n !== null && n <= 30 ? 'text-amber-700' : 'text-gray-900'}`}>{d ? uk(d as string) : '—'}</p></div>;
          })}
        </div>

        {c.people.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Directors and PSCs</p>
            <table className="w-full text-xs">
              <tbody>
                {c.people.map((p, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${p.current ? '' : 'text-gray-400'}`}>
                    <td className="py-1 pr-2 font-medium">{p.name}</td>
                    <td className="pr-2">{p.kind === 'psc' ? 'PSC' : p.role ?? 'Director'}{!p.current && ' (former)'}</td>
                    <td className="text-right">{p.verifiedOn ? <span className="text-green-700">ID verified {uk(p.verifiedOn)}</span> : p.verificationDue ? <span className={daysTo(p.verificationDue)! < 0 ? 'text-red-700 font-semibold' : 'text-amber-700'}>ID due {uk(p.verificationDue)}</span> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {profileRows.length > 0 && (
          <details>
            <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer">CRM profile ({profileRows.length} fields)</summary>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mt-2 text-xs">
              {profileRows.map(([k, v]) => <Fragment key={k}><dt className="text-gray-400">{k.replace(/_/g, ' ')}</dt><dd className="text-gray-900 whitespace-pre-line">{String(v)}</dd></Fragment>)}
            </dl>
          </details>
        )}

        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">All CRM datasets</p>
          {CRM_DATASETS.map((ds) => {
            const list = c.datasets[ds] ?? [];
            return (
              <div key={ds} className="border border-gray-200 rounded-lg">
                <button onClick={() => setOpen(open === ds ? null : ds)} className="w-full flex justify-between px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  <span>{CRM_DATASET_LABELS[ds]}</span><span className={list.length ? 'text-gray-900' : 'text-gray-300'}>{list.length}</span>
                </button>
                {open === ds && list.length > 0 && <DatasetTable rows={list} />}
                {open === ds && !list.length && <p className="px-3 pb-2 text-[11px] text-gray-400">None in the CRM. (That does not prove there are none at Companies House.)</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Any dataset, as a table: the columns are whatever fields the CRM returned. */
function DatasetTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => rows.some((r) => r[k] !== null && r[k] !== '' && typeof r[k] !== 'object'));
  return (
    <div className="overflow-x-auto px-3 pb-2">
      <table className="text-[11px] min-w-full">
        <thead><tr>{cols.map((k) => <th key={k} className="text-left font-medium text-gray-400 pr-3 py-1 whitespace-nowrap">{k.replace(/_/g, ' ')}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-gray-50 align-top">{cols.map((k) => <td key={k} className="pr-3 py-1 text-gray-800">{r[k] === null || r[k] === undefined ? '' : String(r[k])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
