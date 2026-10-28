'use client';

/**
 * Disengagement — ending an engagement and closing the file.
 *
 * The mirror of the engagement screen, and deliberately smaller than it. It
 * produces the letter that says when we ceased to act, sends it, and records
 * the closure. It does not cancel Direct Debits or answer the incoming
 * accountant's clearance enquiry: those are judgements, not consequences of
 * pressing a button, and doing them silently here is how a mandate gets
 * cancelled while fees are still outstanding.
 *
 * Closed clients stay listed. A client who left is still one we acted for, and
 * the file has to stand up years later.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw, ChevronLeft, FileText, Search,
  CheckCircle2, AlertTriangle, X,
} from 'lucide-react';

interface LinkRow {
  id: string; token: string; companyName: string | null; companyNumber: string | null;
  directorName: string | null; clientEmail: string; firmSlug: string | null; status: string;
  acceptedAt: string | null;
  disengagedAt?: string | null;
  disengagedCeasedOn?: string | null;
}

const FIRMS: Record<string, { label: string; color: string }> = {
  gns: { label: 'GNS Ltd', color: '#cc2229' },
  llp: { label: 'GNS LLP', color: '#1e3a8a' },
  galaxy: { label: 'Galaxy', color: '#7c3aed' },
};

const ukDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** What usually has to move to the client when we stop acting. */
const COMMON_HANDBACKS = [
  'File the next set of statutory accounts and confirmation statement',
  'Submit outstanding VAT returns and make the related payments',
  'Operate PAYE and submit RTI returns from the cessation date',
  'Make payments on account of personal tax when they fall due',
  'Maintain the pension scheme and auto-enrolment duties',
];

export default function DisengagementPage() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<LinkRow | null>(null);

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
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link href="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800">
          <ChevronLeft size={16} /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Disengagement</h1>
        <p className="text-sm text-gray-500 mt-1">
          End an engagement, issue the disengagement letter, and close the file. Records are kept, never deleted.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{clients.filter((r) => !r.disengagedAt).length}</p>
          <p className="text-xs text-gray-500 mt-1">Current clients</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{clients.filter((r) => r.disengagedAt).length}</p>
          <p className="text-xs text-gray-500 mt-1">Disengaged</p>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a client by name, director or company number"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw size={22} className="animate-spin text-purple-500" /></div>
      ) : (
        <>
          <Section title="Current clients" empty="No current clients match.">
            {active.map((r) => (
              <Row key={r.id} r={r} action={
                <button
                  onClick={() => setChosen(r)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-red-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  Disengage
                </button>
              } />
            ))}
          </Section>

          {closed.length > 0 && (
            <Section title="Disengaged" empty="">
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

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.flat().filter(Boolean).length === 0;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
      </div>
      {isEmpty ? (
        empty ? <p className="px-5 py-8 text-sm text-gray-400 text-center">{empty}</p> : null
      ) : (
        <div className="divide-y divide-gray-50">{children}</div>
      )}
    </div>
  );
}

function Row({ r, action }: { r: LinkRow; action: React.ReactNode }) {
  const firm = r.firmSlug ? FIRMS[r.firmSlug] : null;
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <Link href={`/staff/clients/${r.token}`} className="min-w-0 flex-1 group">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 group-hover:text-blue-700">{r.companyName ?? 'Unnamed'}</p>
          {firm && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${firm.color}18`, color: firm.color }}>{firm.label}</span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {r.directorName}{r.companyNumber ? ` · ${r.companyNumber}` : ''}
        </p>
      </Link>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}

function DisengageDialog({
  client, onClose, onDone,
}: { client: LinkRow; onClose: () => void; onDone: () => void }) {
  const [ceasedOn, setCeasedOn] = useState('');
  const [reason, setReason] = useState('');
  const [lastWorkDone, setLastWorkDone] = useState('');
  const [outstandingFees, setOutstandingFees] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [handbacks, setHandbacks] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const toggle = (s: string) =>
    setHandbacks((h) => (h.includes(s) ? h.filter((x) => x !== s) : [...h, s]));

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/onboarding/links/${client.token}/disengage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ceasedOn, reason, lastWorkDone, outstandingFees, extraNotes,
          clientMustNowDo: handbacks, sendEmail,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not disengage');

      // Hand the letter straight to the user whether or not it was emailed —
      // partners often post it, and it should never be trapped server-side.
      if (j.pdfBase64) {
        const blob = new Blob(
          [Uint8Array.from(atob(j.pdfBase64), (c) => c.charCodeAt(0))],
          { type: 'application/pdf' },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = j.filename || 'Disengagement_Letter.pdf';
        a.click();
        URL.revokeObjectURL(url);
      }

      setMsg({
        ok: true,
        text: j.emailed
          ? 'Letter produced, emailed to the client, and the file closed.'
          : `Letter produced and the file closed${j.emailError ? ` — but the email failed (${j.emailError}). The PDF has downloaded.` : '. No email was sent.'}`,
      });
      setTimeout(onDone, 1800);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not disengage', ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-xl">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Disengage {client.companyName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Produces the letter, sends it, and closes the file. Nothing is deleted.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800">
              Date we ceased to act <span className="text-red-600">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-1.5">
              This decides who was responsible for anything filed after it, so it is not assumed.
            </p>
            <input
              type="date" value={ceasedOn} onChange={(e) => setCeasedOn(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800">Reason <span className="font-normal text-gray-400">(for our file, not the letter)</span></label>
            <input
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. client moving to another firm, fees unpaid, scope no longer suitable"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800">Work completed before that date</label>
            <textarea
              value={lastWorkDone} onChange={(e) => setLastWorkDone(e.target.value)} rows={2}
              placeholder="e.g. Accounts and CT600 to 31 March 2026 filed; VAT returns to the quarter ended 30 June 2026 submitted."
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800">Now in the client&apos;s hands</p>
            <p className="text-xs text-gray-500 mb-2">Ticked items are listed in the letter.</p>
            <div className="space-y-1.5">
              {COMMON_HANDBACKS.map((s) => (
                <label key={s} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={handbacks.includes(s)} onChange={() => toggle(s)}
                         className="mt-0.5 w-4 h-4 rounded border-gray-300" />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800">Fees</label>
            <input
              value={outstandingFees} onChange={(e) => setOutstandingFees(e.target.value)}
              placeholder="e.g. £1,240 remains outstanding on invoice 2026-118, due on receipt."
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800">Anything else for this letter</label>
            <textarea
              value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} rows={2}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)}
                   className="w-4 h-4 rounded border-gray-300" />
            Email the letter to {client.clientEmail || 'the client'}
          </label>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-900">
              This does not cancel a Direct Debit mandate or reply to an incoming clearance request.
              Deal with those separately so neither happens by accident.
            </p>
          </div>

          {msg && (
            <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !ceasedOn}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
            {busy ? 'Working…' : 'Produce letter & close file'}
          </button>
        </div>
      </div>
    </div>
  );
}
