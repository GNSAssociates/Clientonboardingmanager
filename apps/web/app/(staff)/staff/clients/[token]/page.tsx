'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import KycPanel from './_kyc';
import {
  RefreshCw, ChevronLeft, Eye, Download, FileSignature, FileJson, Banknote,
  CheckCircle2, XCircle, AlertTriangle, RotateCw, FilePlus2, UserSearch, FileText, Cloud, Mail,
  Copy, Check, Send, IdCard, Link2, Clock3,
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
  sendMode?: string;
  paymentMethod?: string;
  gocardless?: { mandateId?: string; ddConfirmed?: boolean; success?: boolean; configured?: boolean; error?: string } | null;
  engagement: {
    status: string; sentAt: string | null; acceptedAt: string | null; expiresAt: string;
    services: Array<{ name: string; price: number; oneoff?: boolean }> | null;
    signatureName: string | null; signedAt: string | null; contactPreferences: string[];
  };
  previousAccountant: {
    firmName: string | null; email: string | null; phone: string | null;
    address?: string | null; noPreviousAccountant?: boolean; missing?: string[];
  };
  uploadedDocs?: {
    required: number;
    receivedRequired: number;
    items: Array<{ id: string; label: string; required: boolean; received: boolean; fileName: string | null; uploadedAt: string | null }>;
  };
  directDebit: {
    accountName: string | null; accountNumber: string | null; sortCode: string | null; bankAddress: string | null;
    gocardless: { configured?: boolean; success?: boolean; ddConfirmed?: boolean; mandateId?: string; error?: string } | null;
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


/**
 * Client links + follow-up actions.
 *
 * Everything a fee-earner needs to chase ONE client without leaving their
 * profile: the two shareable links (engagement + ID portal) with copy buttons,
 * and the two chase actions (resend the engagement letter, chase the director
 * for their ID documents). Previously these lived only on the dashboard, so the
 * client profile had no way to follow up at all.
 */
function ClientLinksPanel({
  token,
  signed,
  onSent,
}: {
  token: string;
  signed: boolean;
  onSent: () => void;
}) {
  const [copied, setCopied] = useState<string>('');
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const engageUrl = origin ? `${origin}/onboarding/engage/${token}` : '';
  const docsUrl = origin ? `${origin}/onboarding/documents/${token}` : '';

  const copy = async (which: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(which);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setMsg({ text: 'Could not copy — select the link and copy manually.', ok: false });
    }
  };

  // Resend the engagement letter email to the director.
  const resendEngagement = async () => {
    setBusy('engage'); setMsg(null);
    try {
      const res = await fetch(`/api/onboarding/links/${token}/resend`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || 'Send failed');
      setMsg({ text: 'Engagement email re-sent to the director.', ok: true });
      onSent();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Send failed', ok: false });
    } finally { setBusy(''); }
  };

  // Chase the director for their outstanding ID documents.
  const chaseDocs = async () => {
    setBusy('docs'); setMsg(null);
    try {
      const res = await fetch(`/api/documents/${token}/followup`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Send failed');
      setMsg({ text: 'ID document reminder sent to the director.', ok: true });
      onSent();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Send failed', ok: false });
    } finally { setBusy(''); }
  };

  const LinkRow = ({ label, url, which, hint }: { label: string; url: string; which: string; hint: string }) => (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <button
          type="button"
          onClick={() => copy(which, url)}
          disabled={!url}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
        >
          {copied === which ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mb-1">{hint}</p>
      <code className="block text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-1 break-all">{url || '…'}</code>
    </div>
  );

  return (
    <div className="gns-reveal gns-press bg-white border border-gray-200 rounded-2xl p-6 transition-shadow hover:shadow-lg">
      <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <Link2 size={16} className="text-purple-600" /> Client Links &amp; Follow-up
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Share these with the director, or chase them from here — no need to go back to the dashboard.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <LinkRow
          label="Engagement letter (sign)"
          url={engageUrl}
          which="engage"
          hint="Where the director reviews and signs."
        />
        <LinkRow
          label="ID document portal"
          url={docsUrl}
          which="docs"
          hint="Where the director uploads their ID and proof of address."
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={resendEngagement}
          disabled={busy !== '' || signed}
          title={signed ? 'Already signed — no follow-up needed.' : 'Re-send the engagement letter email'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-purple-300 text-purple-700 hover:border-purple-500 hover:bg-purple-50 disabled:opacity-50"
        >
          <Send size={13} /> {busy === 'engage' ? 'Sending…' : 'Follow up — resend engagement'}
        </button>
        <button
          type="button"
          onClick={chaseDocs}
          disabled={busy !== ''}
          title="Email the director about their outstanding ID documents"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 hover:border-amber-500 hover:bg-amber-50 disabled:opacity-50"
        >
          <IdCard size={13} /> {busy === 'docs' ? 'Sending…' : 'Chase director — ID documents'}
        </button>
      </div>

      {signed && (
        <p className="text-[11px] text-gray-400 mt-2">
          This engagement is signed, so the engagement follow-up is disabled. You can still chase outstanding ID documents.
        </p>
      )}
      {msg && (
        <p className={`text-xs mt-3 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>
      )}
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
  const sendMode = d.sendMode ?? 'engagement';
  const isDetailsOnly = sendMode === 'details_only';
  const isManualPayment = d.paymentMethod === 'manual';
  const hasPrev = Boolean(d.previousAccountant.firmName);
  const clearanceSent = (emailLog ?? []).some((e) => e.templateKey === 'prev_clearance_request' && e.success);
  const engagementSent = !isDetailsOnly && (emailLog ?? []).some((e) => (e.templateKey === 'client_engagement' || e.templateKey === 'client_proposal') && e.success);

  const PILL = {
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    grey: 'bg-gray-100 text-gray-500 border-gray-200',
  } as const;
  // Per-document status — an authority-only ("details only") signature must NOT
  // read as a signed engagement.
  const steps: Array<{ label: string; text: string; cls: string }> = [
    isDetailsOnly
      ? { label: 'Engagement letter', text: 'Not sent yet', cls: PILL.grey }
      : signed
        ? { label: 'Engagement letter', text: 'Signed', cls: PILL.green }
        : { label: 'Engagement letter', text: engagementSent ? 'Awaiting signature' : 'Draft', cls: engagementSent ? PILL.blue : PILL.grey },
    isDetailsOnly
      ? (signed
          ? { label: 'Accountant authority', text: 'Signed', cls: PILL.green }
          : { label: 'Accountant authority', text: 'Awaiting signature', cls: PILL.blue })
      : (hasPrev
          ? { label: 'Previous accountant', text: 'Provided', cls: PILL.green }
          : signed
            ? { label: 'Previous accountant', text: 'None declared', cls: PILL.grey }
            : { label: 'Previous accountant', text: 'Pending', cls: PILL.amber }),
    clearanceSent
      ? { label: 'Professional clearance', text: 'Sent', cls: PILL.green }
      : hasPrev
        ? { label: 'Professional clearance', text: signed ? 'Sending…' : 'Pending', cls: PILL.amber }
        : { label: 'Professional clearance', text: 'Not required', cls: PILL.grey },
  ];
  const monthly = (d.engagement.services ?? []).filter((s) => !s.oneoff);
  const oneoff = (d.engagement.services ?? []).filter((s) => s.oneoff);
  // New records keep the mandate at the top level (no bank details are stored);
  // older ones nested it under directDebit.
  const gc = d.gocardless ?? d.directDebit?.gocardless;

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
      <div className="gns-reveal gns-press bg-white border border-gray-200 rounded-2xl p-6 transition-shadow hover:shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {firm && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${firm.color}18`, color: firm.color }}>{firm.label}</span>}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${signed ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                {signed ? (isDetailsOnly ? 'Authority signed' : 'Signed') : 'Awaiting signature'}
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
            {/* Granular per-document status — what's signed vs still pending */}
            <div className="flex flex-wrap gap-2 mt-3">
              {steps.map((s) => (
                <span key={s.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${s.cls}`}>
                  <span className="opacity-70 font-normal">{s.label}:</span> {s.text}
                </span>
              ))}
            </div>
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
      <div className="gns-reveal gns-press bg-white border border-gray-200 rounded-2xl p-6 transition-shadow hover:shadow-lg">
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
          <a href={`/api/onboarding/links/${token}/letter?docx=1`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-300 text-blue-700 hover:border-blue-500 hover:bg-blue-50">
            <FileText size={13} /> Download Word
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

      {/* Client links + follow-up actions */}
      <ClientLinksPanel token={token} signed={signed} onSent={load} />

      {/* AI ID verification (KYC) */}
      <KycPanel token={token} expectedName={d?.director?.name} />

      {/* Email History — what we've sent to (or about) this client */}
      <div className="gns-reveal gns-press bg-white border border-gray-200 rounded-2xl p-6 transition-shadow hover:shadow-lg">
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
        {/* Direct Debit — GoCardless mandate status.
            The client sets the mandate up on GoCardless's own hosted page, so the
            practice never receives or stores bank details. This card therefore
            reports the MANDATE, not account numbers (older records captured
            before that change still show their masked summary). */}
        <div className="gns-reveal gns-press bg-white border border-gray-200 rounded-2xl p-6 transition-shadow hover:shadow-lg">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><Banknote size={16} className="text-purple-600" /> Direct Debit</h2>
          <p className="text-xs text-gray-400 mb-4">Set up by the client on GoCardless — we never see or store bank details.</p>

          {isManualPayment ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700">Manual invoicing</p>
              <p className="text-xs text-gray-500 mt-1">This engagement is invoiced manually — no Direct Debit is required.</p>
            </div>
          ) : gc?.mandateId || gc?.ddConfirmed || gc?.success ? (
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={18} className="text-green-600" />
                <span className="text-sm font-bold text-green-800">Mandate confirmed</span>
              </div>
              {gc?.mandateId && (
                <p className="text-xs text-green-700">Mandate — <span className="font-mono font-semibold">{gc.mandateId}</span></p>
              )}
            </div>
          ) : signed ? (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={18} className="text-red-600" />
                <span className="text-sm font-bold text-red-800">Signed without a confirmed mandate</span>
              </div>
              <p className="text-xs text-red-700">{gc?.error || 'No mandate recorded — set one up before collecting fees.'}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock3 size={16} className="text-amber-600" />
                <span className="text-sm font-bold text-amber-800">Not set up yet</span>
              </div>
              <p className="text-xs text-amber-700">The client sets this up on the engagement page. They cannot sign until it is confirmed.</p>
            </div>
          )}

          {/* Legacy records only: bank details captured before the hosted flow. */}
          {d.directDebit?.accountNumber && (
            <p className="text-xs text-gray-400 mt-3">
              Legacy record — account ending {String(d.directDebit.accountNumber).slice(-4)}
            </p>
          )}
          {msg && <p className="text-xs mt-2 text-gray-700">{msg}</p>}
        </div>

        {/* Previous accountant */}
        <div className="gns-reveal gns-press bg-white border border-gray-200 rounded-2xl p-6 transition-shadow hover:shadow-lg">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><UserSearch size={16} className="text-purple-600" /> Previous Accountant</h2>
          {d.previousAccountant.noPreviousAccountant ? (
            <p className="text-sm text-gray-500">Client confirmed they have no previous accountant — no clearance needed.</p>
          ) : d.previousAccountant.firmName || d.previousAccountant.email ? (
            <>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between gap-4"><dt className="text-gray-500">Firm</dt><dd className="font-semibold text-gray-900 text-right">{d.previousAccountant.firmName ?? '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-gray-500">Email</dt><dd className="text-gray-900 text-right break-all">{d.previousAccountant.email ?? '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-gray-500">Phone</dt><dd className="text-gray-900 text-right">{d.previousAccountant.phone ?? '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-gray-500">Address</dt><dd className="text-gray-900 text-right whitespace-pre-line">{d.previousAccountant.address ?? '—'}</dd></div>
              </dl>
              {/* Small, factual line so staff can see at a glance whether the
                  clearance request can actually be sent. */}
              {(d.previousAccountant.missing?.length ?? 0) > 0 ? (
                <p className="text-[11px] text-amber-700 mt-3">
                  Still outstanding: {d.previousAccountant.missing!.join(', ')}
                </p>
              ) : (
                <p className="text-[11px] text-green-700 mt-3">All details received.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">{signed ? 'Not provided.' : 'Collected when the client signs.'}</p>
          )}
          <Link href="/staff/clearance" className="inline-block mt-4 text-xs text-blue-600 hover:underline">Open clearance tracker →</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Services */}
        <div className="gns-reveal gns-press bg-white border border-gray-200 rounded-2xl p-6 transition-shadow hover:shadow-lg">
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
        <div className="gns-reveal gns-press bg-white border border-gray-200 rounded-2xl p-6 transition-shadow hover:shadow-lg">
          <h2 className="font-semibold text-gray-900 mb-4">Director ID Documents</h2>
          {/* What was REQUESTED vs what has actually ARRIVED. The list used to show
              only the client's intention at signing ("I'll send it later"), which
              never changed even after they uploaded, so staff could not tell what
              was genuinely outstanding. */}
          {d.uploadedDocs && (
            <p className={`text-xs mb-3 font-semibold ${
              d.uploadedDocs.receivedRequired >= d.uploadedDocs.required ? 'text-green-700' : 'text-amber-700'
            }`}>
              {d.uploadedDocs.receivedRequired} of {d.uploadedDocs.required} required documents received
              {d.uploadedDocs.receivedRequired < d.uploadedDocs.required
                ? ` · ${d.uploadedDocs.required - d.uploadedDocs.receivedRequired} still needed`
                : ' · complete'}
            </p>
          )}
          {d.uploadedDocs && d.uploadedDocs.items.length > 0 ? (
            <div className="space-y-2">
              {d.uploadedDocs.items.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-700">
                    {doc.label}
                    {doc.required && <span className="text-[10px] text-gray-400 ml-1">required</span>}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                    doc.received ? 'bg-green-100 text-green-700' : doc.required ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {doc.received ? 'Received' : doc.required ? 'Outstanding' : 'Optional'}
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
          ) : (
            <p className="text-sm text-gray-500">
              {signed ? 'No documents requested for this client.' : 'The document list appears once the client signs.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
