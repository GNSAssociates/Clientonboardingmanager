'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  RefreshCw, ChevronLeft, Eye, Download, FileSignature, FileJson, Banknote,
  CheckCircle2, XCircle, AlertTriangle, RotateCw, FilePlus2, UserSearch, FileText, Cloud, Mail,
} from 'lucide-react';

interface EmailLogRow {
  id: string; templateKey: string; toEmail: string; toName: string | null;
  subject: string; provider: string; success: boolean; error: string | null; sentAt: string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  client_engagement: 'Engagement letter',
  client_proposal: 'Proposal',
  client_details_request: 'Previous accountant details request',
  client_welcome: 'Welcome (signed)',
  prev_clearance_request: 'Professional clearance request',
  prev_clearance_chase: 'Clearance follow-up',
  client_doc_reminder: 'ID document reminder',
};

interface Details {
  company: { name: string | null; number: string | null };
  director: { name: string | null; email: string };
  firm: string | null;
  engagement: {
    status: string; sentAt: string | null; acceptedAt: string | null; expiresAt: string;
    services: Array<{ name: string; price: number; oneoff?: boolean }> | null;
    signatureName: string | null; signedAt: string | null; contactPreferences: string[];
  };
  previousAccountant: { firmName: string | null; email: string | null; phone: string | null };
  directDebit: {
    accountName: string | null; accountNumber: string | null; sortCode: string | null; bankAddress: string | null;
    gocardless: { configured?: boolean; success?: boolean; mandateId?: string; error?: string } | null;
  } | null;
  documents: { director: Array<{ label: string; status: string }>; company: Array<{ label: string; status: string }> };
  stopClientChase?: boolean;
  audit: { ipAddress?: string; documentSha256?: string } | null;
}

const FIRMS: Record<string, { label: string; color: string }> = {
  gns:    { label: 'GNS Associates Ltd',    color: '#cc2229' },
  llp:    { label: 'GNS Associates UK LLP', color: '#1e3a8a' },
  galaxy: { label: 'Galaxy Accountants',    color: '#7c3aed' },
};

interface TemplateOption { key: string; name: string; audience: string }

// Manually send any template (built-in or custom) to this client — for ad-hoc
// sends that don't fit the automatic flows, e.g. a bespoke clearance letter.
function SendTemplateForm({ token, details, onSent }: { token: string; details: Details; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [key, setKey] = useState('');
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const openForm = async () => {
    setOpen(true); setMsg('');
    if (!templates) {
      const res = await fetch('/api/templates').then((r) => (r.ok ? r.json() : null));
      const opts: TemplateOption[] = res?.templates?.map((t: { key: string; name: string; audience: string }) =>
        ({ key: t.key, name: t.name, audience: t.audience })) ?? [];
      setTemplates(opts);
      if (opts[0]) selectTemplate(opts[0]);
    }
  };

  const selectTemplate = (t: TemplateOption) => {
    setKey(t.key);
    if (t.audience === 'Previous Accountant') {
      setTo(details.previousAccountant.email ?? '');
      setToName(details.previousAccountant.firmName ?? '');
    } else {
      setTo(details.director.email ?? '');
      setToName(details.director.name ?? '');
    }
  };

  const send = async () => {
    if (!key || !to.trim()) { setMsg('Choose a template and a recipient email.'); return; }
    setSending(true); setMsg('');
    try {
      const res = await fetch(`/api/onboarding/links/${token}/send-template`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, to: to.trim(), toName: toName.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Send failed');
      setMsg('Sent.');
      onSent();
      setTimeout(() => { setOpen(false); setMsg(''); }, 1200);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally { setSending(false); }
  };

  if (!open) {
    return (
      <button onClick={openForm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-purple-300 text-purple-700 hover:border-purple-500 hover:bg-purple-50">
        <Mail size={13} /> Send an email
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={key} onChange={(e) => { const t = templates?.find((x) => x.key === e.target.value); if (t) selectTemplate(t); }}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-500">
        {templates === null && <option>Loading…</option>}
        {templates?.map((t) => <option key={t.key} value={t.key}>{t.name} ({t.audience})</option>)}
      </select>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient email" type="email"
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-purple-500" />
      <input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Recipient name (optional)"
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-purple-500" />
      <button onClick={send} disabled={sending}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40">
        {sending ? 'Sending…' : 'Send'}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      {msg && <span className={`text-xs ${msg === 'Sent.' ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>}
    </div>
  );
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [d, setD] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [savingChase, setSavingChase] = useState(false);
  const [msg, setMsg] = useState('');
  const [emailLog, setEmailLog] = useState<EmailLogRow[] | null>(null);

  const load = useCallback(() => {
    fetch(`/api/onboarding/links/${token}/details`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setD)
      .finally(() => setLoading(false));
    fetch(`/api/onboarding/links/${token}/email-log`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setEmailLog(j?.emails ?? []));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleClientChase = async () => {
    setSavingChase(true);
    try {
      const res = await fetch(`/api/onboarding/links/${token}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopClientChase: !d?.stopClientChase }),
      });
      if (res.ok) load();
    } finally { setSavingChase(false); }
  };

  const retryGc = async () => {
    setRetrying(true);
    setMsg('');
    try {
      const res = await fetch(`/api/onboarding/links/${token}/gocardless-retry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Retry failed');
      setMsg(`✅ Mandate created — ${(data as { mandateId?: string }).mandateId}`);
      load();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Retry failed'}`);
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-32"><RefreshCw size={24} className="animate-spin text-purple-500" /></div>;
  if (!d) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <AlertTriangle className="mx-auto text-amber-500 mb-3" size={36} />
      <p className="font-bold text-gray-900">Client not found</p>
      <Link href="/staff/clients" className="text-sm text-blue-600 hover:underline mt-2 inline-block">← All clients</Link>
    </div>
  );

  const firm = d.firm ? FIRMS[d.firm] : null;
  const signed = d.engagement.status === 'accepted';
  const monthly = (d.engagement.services ?? []).filter((s) => !s.oneoff);
  const oneoff = (d.engagement.services ?? []).filter((s) => s.oneoff);
  const gc = d.directDebit?.gocardless;

  const docBadge = (status: string) =>
    status === 'ready' ? 'bg-green-50 text-green-700'
    : status === 'na' ? 'bg-gray-100 text-gray-500'
    : 'bg-amber-50 text-amber-700';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <button onClick={() => router.push('/staff/clients')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ChevronLeft size={16} /> All clients
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {firm && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${firm.color}18`, color: firm.color }}>{firm.label}</span>}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${signed ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                {signed ? 'Signed' : 'Awaiting signature'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{d.company.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {d.company.number && <>Company No. {d.company.number} · </>}
              {d.director.name} · {d.director.email}
            </p>
            {signed && d.engagement.signatureName && (
              <p className="text-xs text-green-700 mt-1">
                Signed by <strong>{d.engagement.signatureName}</strong>
                {d.engagement.signedAt && <> on {new Date(d.engagement.signedAt).toLocaleString('en-GB')}</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/onboarding/services?firm=${d.firm ?? 'gns'}&companyNumber=${encodeURIComponent(d.company.number ?? '')}&directorEmail=${encodeURIComponent(d.director.email)}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-500"
            >
              <FilePlus2 size={13} /> New Engagement
            </Link>
            <a href={`/api/onboarding/links/${token}/details?download=1`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-500">
              <FileJson size={13} /> Export Details
            </a>
            <a href={`/api/onboarding/links/${token}/onedrive`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-sky-300 text-sky-700 hover:border-sky-500 hover:bg-sky-50">
              <Cloud size={13} /> Open OneDrive Folder
            </a>
          </div>
        </div>
      </div>

      {/* Letters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText size={16} className="text-purple-600" /> Engagement Letter</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={`/api/onboarding/links/${token}/letter`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-500">
            <Eye size={13} /> View Letter
          </a>
          <a href={`/api/onboarding/links/${token}/letter?pdf=1&download=1`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-500">
            <Download size={13} /> Download PDF
          </a>
          {signed && (
            <>
              <a href={`/api/onboarding/links/${token}/letter?signed=1&pdf=1`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700">
                <FileSignature size={13} /> Signed PDF + Audit Report
              </a>
              <a href={`/api/onboarding/links/${token}/letter?signed=1&pdf=1&download=1`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border-2 border-green-600 text-green-700 hover:bg-green-50">
                <Download size={13} /> Download Signed PDF
              </a>
            </>
          )}
        </div>
        {!signed && <p className="text-xs text-gray-400 mt-3">The signed copy with the audit report appears here as soon as the client signs.</p>}
      </div>

      {/* Email History — what we've sent to (or about) this client */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Mail size={16} className="text-purple-600" /> Email History</h2>
          {d && <SendTemplateForm token={token} details={d} onSent={load} />}
        </div>
        {emailLog === null ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : emailLog.length === 0 ? (
          <p className="text-xs text-gray-400">No emails sent yet for this client.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {emailLog.map((e) => (
              <div key={e.id} className="py-2.5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {TEMPLATE_LABELS[e.templateKey] ?? e.templateKey} &middot; to {e.toName ? `${e.toName} ` : ''}&lt;{e.toEmail}&gt;
                  </p>
                  {!e.success && e.error && <p className="text-xs text-red-600 mt-0.5 truncate" title={e.error}>Failed: {e.error}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{new Date(e.sentAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${e.success ? 'text-green-600' : 'text-red-600'}`}>{e.success ? 'Sent' : 'Failed'} &middot; {e.provider}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Direct Debit / GoCardless */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><Banknote size={16} className="text-purple-600" /> Direct Debit Mandate</h2>
          <p className="text-xs text-gray-400 mb-4">Full details shown to staff only — use to retry if the client&apos;s input failed.</p>
          {d.directDebit ? (
            <>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between"><dt className="text-gray-500">Account holder</dt><dd className="font-semibold text-gray-900">{d.directDebit.accountName ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Account number</dt><dd className="font-mono font-semibold text-gray-900">{d.directDebit.accountNumber ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Sort code</dt><dd className="font-mono font-semibold text-gray-900">{d.directDebit.sortCode ?? '—'}</dd></div>
                {d.directDebit.bankAddress && <div className="flex justify-between"><dt className="text-gray-500">Address as per bank</dt><dd className="text-gray-900 text-right">{d.directDebit.bankAddress}</dd></div>}
              </dl>
              <div className="mt-4 pt-4 border-t border-gray-100">
                {gc?.success ? (
                  <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 size={18} className="text-green-600" />
                      <span className="text-sm font-bold text-green-800">GoCardless Active</span>
                    </div>
                    <p className="text-xs text-green-700">Direct Debit Mandate — <span className="font-mono font-semibold">{gc.mandateId}</span></p>
                  </div>
                ) : gc?.configured ? (
                  <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle size={18} className="text-red-600" />
                      <span className="text-sm font-bold text-red-800">GoCardless Failed</span>
                    </div>
                    <p className="text-xs text-red-700">{gc.error || 'Mandate setup did not complete — retry below.'}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={18} className="text-amber-600" />
                      <span className="text-sm font-bold text-amber-800">Not Configured</span>
                    </div>
                    <p className="text-xs text-amber-700">GoCardless token not set — bank details stored for manual setup or retry once configured.</p>
                  </div>
                )}
                {!gc?.success && (
                  <button onClick={retryGc} disabled={retrying}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50">
                    {retrying ? <RefreshCw size={13} className="animate-spin" /> : <RotateCw size={13} />}
                    Retry GoCardless Setup
                  </button>
                )}
                {msg && <p className="text-xs mt-2 text-gray-700">{msg}</p>}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No bank details yet — collected when the client signs.</p>
          )}
        </div>

        {/* Previous accountant */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><UserSearch size={16} className="text-purple-600" /> Previous Accountant</h2>
          {d.previousAccountant.firmName || d.previousAccountant.email ? (
            <dl className="text-sm space-y-2">
              <div className="flex justify-between"><dt className="text-gray-500">Firm</dt><dd className="font-semibold text-gray-900">{d.previousAccountant.firmName ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd className="text-gray-900">{d.previousAccountant.email ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Phone</dt><dd className="text-gray-900">{d.previousAccountant.phone ?? '—'}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">{signed ? 'Client confirmed they have no previous accountant.' : 'Collected when the client signs.'}</p>
          )}
          <Link href="/staff/clearance" className="inline-block mt-4 text-xs text-blue-600 hover:underline">Open clearance tracker →</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Services */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Agreed Services</h2>
          {monthly.length + oneoff.length === 0 ? (
            <p className="text-sm text-gray-500">No services on this engagement.</p>
          ) : (
            <div className="space-y-1.5 text-sm">
              {monthly.map((s, i) => (
                <div key={`m${i}`} className="flex justify-between"><span className="text-gray-700">{s.name}</span><span className="font-semibold">£{s.price}/mo</span></div>
              ))}
              {oneoff.map((s, i) => (
                <div key={`o${i}`} className="flex justify-between"><span className="text-gray-700">{s.name} <span className="text-xs text-gray-400">(one-off)</span></span><span className="font-semibold">£{s.price}</span></div>
              ))}
              <div className="flex justify-between border-t border-gray-100 pt-2 mt-2 font-bold">
                <span>Monthly total</span><span>£{monthly.reduce((t, s) => t + s.price, 0)}/mo</span>
              </div>
            </div>
          )}
        </div>

        {/* Director documents */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Director ID Documents</h2>
          {(d.documents.director ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">Statuses appear when the client signs.</p>
          ) : (
            <div className="space-y-2">
              {d.documents.director.map((doc, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{doc.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${docBadge(doc.status)}`}>
                    {doc.status === 'ready' ? 'Ready to upload' : doc.status === 'na' ? 'Via prev. accountant' : 'Chasing every 2 days'}
                  </span>
                </div>
              ))}
              <a href={`/onboarding/documents/${token}`} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-blue-600 hover:underline">
                Open upload portal →
              </a>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button onClick={toggleClientChase} disabled={savingChase}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    d.stopClientChase ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}>
                  {savingChase ? <RefreshCw size={12} className="animate-spin" /> : null}
                  {d.stopClientChase ? 'Resume document reminders' : 'Stop chasing client for documents'}
                </button>
                {d.stopClientChase && <p className="text-xs text-amber-700 mt-2">⏸ 2-day document reminders paused for this client.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
