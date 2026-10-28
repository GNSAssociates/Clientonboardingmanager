'use client';

/**
 * Disengagement — ending an engagement and closing the file.
 *
 * The mirror of the engagement side, and shaped like it on purpose: fill in
 * the details, look at the letter, then send. Staff should not have to learn a
 * second way of doing the same job.
 *
 * Most of the practice's clients predate this system, so a client can be
 * disengaged whether or not they were onboarded through it — "New
 * disengagement" creates the record first.
 *
 * Closed clients stay listed. A client who left is still one we acted for, and
 * the file has to stand up years later.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw, ChevronLeft, FileText, Search, Plus, X,
  CheckCircle2, AlertTriangle, ExternalLink, Send,
} from 'lucide-react';

interface LinkRow {
  id: string; token: string; companyName: string | null; companyNumber: string | null;
  directorName: string | null; clientEmail: string; firmSlug: string | null; status: string;
  acceptedAt: string | null;
  disengagedAt?: string | null;
  disengagedCeasedOn?: string | null;
}

interface PreviewData {
  filename: string;
  pdfBase64: string;
  oneDriveFolderUrl: string | null;
  clientEmail: string | null;
  hasMandate: boolean;
}

const FIRMS: Record<string, { label: string; color: string }> = {
  gns: { label: 'GNS Ltd', color: '#cc2229' },
  llp: { label: 'GNS LLP', color: '#1e3a8a' },
  galaxy: { label: 'Galaxy', color: '#7c3aed' },
};

const ukDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** Services the letter can name as ending. */
const SERVICE_OPTIONS = [
  'Annual accounts', 'Corporation tax', 'VAT returns', 'Bookkeeping',
  'Payroll', 'Pensions / auto-enrolment', 'Personal tax returns',
  'Confirmation statement', 'Registered office', 'Company secretarial',
];

/** What usually falls back to the client when we stop acting. */
const COMMON_HANDBACKS = [
  'File the next set of statutory accounts and confirmation statement',
  'Submit outstanding VAT returns and make the related payments',
  'Operate PAYE and submit RTI returns from the cessation date',
  'Make payments on account of personal tax when they fall due',
  'Maintain the pension scheme and auto-enrolment duties',
];

const pdfBlobUrl = (b64: string) =>
  URL.createObjectURL(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'application/pdf' }));

export default function DisengagementPage() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<LinkRow | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/onboarding/links/list')
      .then((r) => r.json())
      .then((d: LinkRow[]) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const clients = rows.filter((r) => r.status === 'accepted');
  const needle = q.trim().toLowerCase();
  const matches = (r: LinkRow) =>
    !needle ||
    (r.companyName ?? '').toLowerCase().includes(needle) ||
    (r.directorName ?? '').toLowerCase().includes(needle) ||
    (r.companyNumber ?? '').toLowerCase().includes(needle);

  const active = clients.filter((r) => !r.disengagedAt).filter(matches);
  const closed = clients.filter((r) => r.disengagedAt).filter(matches);

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800">
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Disengagement</h1>
          <p className="text-sm text-gray-500">
            End an engagement, issue the letter, and close the file. Records are kept, never deleted.
          </p>
        </div>
        <button
          onClick={() => setAddingNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800"
        >
          <Plus size={15} /> New disengagement
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat value={clients.filter((r) => !r.disengagedAt).length} label="Current clients" />
        <Stat value={clients.filter((r) => r.disengagedAt).length} label="Disengaged" tone="amber" />
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Find a client by name, director or company number"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw size={22} className="animate-spin text-purple-500" /></div>
      ) : (
        <>
          <Section title={`Current clients (${active.length})`} empty="No current clients match.">
            {active.map((r) => (
              <Row key={r.id} r={r} action={
                <button
                  onClick={() => setChosen(r)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-red-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  Disengage
                </button>
              } />
            ))}
          </Section>

          {closed.length > 0 && (
            <Section title={`Disengaged (${closed.length})`} empty="">
              {closed.map((r) => (
                <Row key={r.id} r={r} action={
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 bg-white text-[11px] font-semibold text-gray-500">
                    <CheckCircle2 size={11} className="text-green-600" />
                    Ceased {ukDate(r.disengagedCeasedOn ?? r.disengagedAt)}
                  </span>
                } />
              ))}
            </Section>
          )}
        </>
      )}

      {addingNew && (
        <NewClientDialog
          onClose={() => setAddingNew(false)}
          onCreated={(token, companyName) => {
            setAddingNew(false);
            setChosen({
              id: token, token, companyName, companyNumber: null, directorName: null,
              clientEmail: '', firmSlug: 'gns', status: 'accepted', acceptedAt: null,
            });
            load();
          }}
        />
      )}

      {chosen && (
        <DisengageDialog
          client={chosen}
          onClose={() => setChosen(null)}
          onDone={() => { setChosen(null); load(); }}
        />
      )}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'amber' }) {
  return (
    <div className={`${tone === 'amber' ? 'bg-amber-50' : 'bg-gray-50'} rounded-xl p-3 text-center`}>
      <p className={`text-2xl font-bold ${tone === 'amber' ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.flat().filter(Boolean).length === 0;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
      </div>
      {isEmpty
        ? (empty ? <p className="px-4 py-6 text-sm text-gray-400 text-center">{empty}</p> : null)
        : <div className="divide-y divide-gray-50">{children}</div>}
    </div>
  );
}

function Row({ r, action }: { r: LinkRow; action: React.ReactNode }) {
  const firm = r.firmSlug ? FIRMS[r.firmSlug] : null;
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2">
      <Link href={`/staff/clients/${r.token}`} className="min-w-0 flex-1 group">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-700">{r.companyName ?? 'Unnamed'}</p>
          {firm && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: `${firm.color}18`, color: firm.color }}>{firm.label}</span>
          )}
        </div>
        <p className="text-xs text-gray-500">{r.directorName}{r.companyNumber ? ` · ${r.companyNumber}` : ''}</p>
      </Link>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}

/** Enter a client who was never onboarded here, so they can be disengaged. */
function NewClientDialog({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (token: string, companyName: string) => void }) {
  const [companyName, setCompanyName] = useState('');
  const [companyNumber, setCompanyNumber] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [firmSlug, setFirmSlug] = useState('gns');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/disengagement/adhoc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, companyNumber, directorName, clientEmail, clientAddress, firmSlug }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not add the client');
      onCreated(j.token, j.companyName);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add the client');
    } finally { setBusy(false); }
  };

  return (
    <Modal title="New disengagement" subtitle="For a client who was not onboarded through this system." onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
        <Field label="Client name" required value={companyName} onChange={setCompanyName} placeholder="Acme Trading Ltd" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company number" value={companyNumber} onChange={setCompanyNumber} placeholder="12345678" />
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Firm</label>
            <select value={firmSlug} onChange={(e) => setFirmSlug(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
              {Object.entries(FIRMS).map(([s, f]) => <option key={s} value={s}>{f.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact name" value={directorName} onChange={setDirectorName} placeholder="Jane Smith" />
          <Field label="Email" value={clientEmail} onChange={setClientEmail} placeholder="jane@acme.co.uk"
                 hint="Optional — leave blank to send the letter by post." />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Address <span className="font-normal text-gray-400">(appears on the letter)</span></label>
          <textarea value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
        </div>
        {err && <p className="text-sm text-red-700">{err}</p>}
      </div>
      <Footer onClose={onClose} onGo={go} busy={busy} disabled={!companyName.trim()} label="Add & continue" />
    </Modal>
  );
}

function DisengageDialog({
  client, onClose, onDone,
}: { client: LinkRow; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<'details' | 'preview'>('details');
  const [ceasedOn, setCeasedOn] = useState('');
  const [reason, setReason] = useState('');
  const [lastWorkDone, setLastWorkDone] = useState('');
  const [outstandingFees, setOutstandingFees] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [handbacks, setHandbacks] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [cancelDd, setCancelDd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const toggle = (list: string[], set: (v: string[]) => void, s: string) =>
    set(list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);

  const payload = () => ({
    ceasedOn, reason, lastWorkDone, outstandingFees, extraNotes,
    services, clientMustNowDo: handbacks, sendEmail, cancelDirectDebit: cancelDd,
  });

  const doPreview = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/onboarding/links/${client.token}/disengage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload(), mode: 'preview' }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not produce the letter');
      setPreview(j);
      setPreviewUrl(pdfBlobUrl(j.pdfBase64));
      setStep('preview');
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not produce the letter', ok: false });
    } finally { setBusy(false); }
  };

  const doSend = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/onboarding/links/${client.token}/disengage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload(), mode: 'send' }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not disengage');

      const bits: string[] = [];
      bits.push(j.emailed ? 'Letter emailed to the client' : (j.emailError ? `Email FAILED (${j.emailError})` : 'No email sent'));
      if (j.mandateCancelled === true) bits.push('Direct Debit cancelled');
      else if (j.mandateCancelled === false) bits.push(`Direct Debit NOT cancelled (${j.mandateError ?? 'failed'})`);
      if (j.archivedTo) bits.push('filed in OneDrive');
      bits.push('file closed');

      setMsg({ ok: j.emailed || j.mandateCancelled !== false, text: bits.join(' · ') + '.' });
      setTimeout(onDone, 2600);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not disengage', ok: false });
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title={`Disengage ${client.companyName}`}
      subtitle={step === 'details'
        ? 'Fill in the details, then look at the letter before anything is sent.'
        : 'Check the letter. Sending it cancels the Direct Debit and closes the file.'}
      onClose={onClose}
      wide={step === 'preview'}
    >
      {step === 'details' ? (
        <div className="px-5 py-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800">
                Date we ceased to act <span className="text-red-600">*</span>
              </label>
              <p className="text-[11px] text-gray-500 mb-1">
                Decides who was responsible for anything filed after it, so it is not assumed.
              </p>
              <input type="date" value={ceasedOn} onChange={(e) => setCeasedOn(e.target.value)}
                     className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
            <Field label="Reason" hint="For our file, not the letter." value={reason} onChange={setReason}
                   placeholder="e.g. moving to another firm, fees unpaid" />
          </div>

          <Checks title="Services ending" subtitle="Named in the letter."
                  options={SERVICE_OPTIONS} chosen={services}
                  onToggle={(s) => toggle(services, setServices, s)} columns />

          <div>
            <label className="block text-sm font-semibold text-gray-800">Work completed before that date</label>
            <textarea value={lastWorkDone} onChange={(e) => setLastWorkDone(e.target.value)} rows={2}
                      placeholder="e.g. Accounts and CT600 to 31 March 2026 filed; VAT to the quarter ended 30 June 2026 submitted."
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>

          <Checks title="Now in the client's hands" subtitle="Ticked items are listed in the letter."
                  options={COMMON_HANDBACKS} chosen={handbacks}
                  onToggle={(s) => toggle(handbacks, setHandbacks, s)} />

          <Field label="Fees" value={outstandingFees} onChange={setOutstandingFees}
                 placeholder="e.g. £1,240 outstanding on invoice 2026-118, due on receipt." />

          <div>
            <label className="block text-sm font-semibold text-gray-800">Anything else for this letter</label>
            <textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} rows={2}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>

          {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
        </div>
      ) : (
        <div className="px-5 py-4 space-y-3">
          {previewUrl && (
            <iframe src={previewUrl} title="Disengagement letter" className="w-full h-[55vh] border border-gray-200 rounded-lg" />
          )}

          <div className="flex items-center gap-3 flex-wrap text-sm">
            {previewUrl && (
              <a href={previewUrl} download={preview?.filename}
                 className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <FileText size={14} /> Download a copy
              </a>
            )}
            {preview?.oneDriveFolderUrl && (
              <a href={preview.oneDriveFolderUrl} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <ExternalLink size={14} /> Open their OneDrive folder
              </a>
            )}
          </div>

          <div className="space-y-1.5 border-t border-gray-100 pt-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)}
                     disabled={!preview?.clientEmail} className="w-4 h-4 rounded border-gray-300" />
              Email the letter to {preview?.clientEmail || 'the client'}
              {!preview?.clientEmail && <span className="text-xs text-gray-400">— no email on file, send by post</span>}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={cancelDd} onChange={(e) => setCancelDd(e.target.checked)}
                     disabled={!preview?.hasMandate} className="w-4 h-4 rounded border-gray-300" />
              Cancel their Direct Debit mandate
              {!preview?.hasMandate && <span className="text-xs text-gray-400">— no mandate on file</span>}
            </label>
          </div>

          {cancelDd && preview?.hasMandate && outstandingFees.trim() && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-900">
                You have recorded outstanding fees and are also cancelling the mandate — after this you cannot
                collect them by Direct Debit.
              </p>
            </div>
          )}

          {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-100">
        <button onClick={step === 'preview' ? () => setStep('details') : onClose}
                className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
          {step === 'preview' ? '← Back' : 'Cancel'}
        </button>
        {step === 'details' ? (
          <button onClick={doPreview} disabled={busy || !ceasedOn}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
            {busy ? 'Producing…' : 'Preview letter'}
          </button>
        ) : (
          <button onClick={doSend} disabled={busy}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-40">
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {busy ? 'Sending…' : 'Send & close file'}
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ── small shared pieces ──────────────────────────────────────────────── */

function Modal({
  title, subtitle, onClose, wide, children,
}: { title: string; subtitle?: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} my-6 shadow-xl`}>
        <div className="flex items-start justify-between gap-4 px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Footer({
  onClose, onGo, busy, disabled, label,
}: { onClose: () => void; onGo: () => void; busy: boolean; disabled?: boolean; label: string }) {
  return (
    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
      <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">Cancel</button>
      <button onClick={onGo} disabled={busy || disabled}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
        {busy ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
        {busy ? 'Working…' : label}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, hint, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800">
        {label}{required && <span className="text-red-600"> *</span>}
        {hint && <span className="font-normal text-gray-400"> — {hint}</span>}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
             className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
    </div>
  );
}

function Checks({
  title, subtitle, options, chosen, onToggle, columns,
}: {
  title: string; subtitle?: string; options: string[]; chosen: string[];
  onToggle: (s: string) => void; columns?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {subtitle && <p className="text-[11px] text-gray-500 mb-1">{subtitle}</p>}
      <div className={columns ? 'grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1' : 'space-y-1'}>
        {options.map((s) => (
          <label key={s} className="flex items-start gap-2 text-[13px] text-gray-700 cursor-pointer">
            <input type="checkbox" checked={chosen.includes(s)} onChange={() => onToggle(s)}
                   className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 flex-shrink-0" />
            <span>{s}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
