'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Mail, Braces, Eye, Handshake, FileSignature, Save, RotateCcw, ChevronDown, Check, Loader2, Plus, Trash2, X } from 'lucide-react';

type Tab = 'letters' | 'emails' | 'variables';

interface TemplateCard {
  name: string;
  when: string;
  icon: React.ReactNode;
  preview?: () => void;
}

const SAMPLE = {
  firmSlug: 'gns',
  companyName: 'SAMPLE CLIENT LTD',
  companyNumber: '12345678',
  clientAddress: '1 Example Street, London, EC1A 1AA',
  directorName: 'Sample Director',
  partnerName: 'Subash Ghimire',
  regBody: 'ACCA',
  services: [
    { id: 'annual_accounts', name: 'Annual Accounts & Corporation Tax', price: 150, oneoff: false },
    { id: 'paye', name: 'PAYE & Pension', price: 75, oneoff: false },
  ],
  ch: { number: '12345678', status: 'Active', address: '1 Example Street, London, EC1A 1AA', incorporationDate: '2019-05-01', natureOfBusiness: '62020' },
};

async function previewLetter(regBody: string) {
  const res = await fetch('/api/onboarding/letter-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...SAMPLE, regBody }),
  });
  if (!res.ok) { alert('Could not build preview'); return; }
  const html = await res.text();
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Editable email templates ────────────────────────────────────────────────
interface EmailTemplate {
  key: string;
  name: string;
  audience: string;
  description: string;
  ctaLabel: string | null;
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  isOverridden: boolean;
  isCustom: boolean;
  updatedAt: string | null;
}

function EmailEditor({ tpl, variables, onSaved, onDeleted }: {
  tpl: EmailTemplate;
  variables: Array<[string, string]>;
  onSaved: (t: EmailTemplate) => void;
  onDeleted: (key: string) => void;
}) {
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const dirty = subject !== tpl.subject || body !== tpl.body;

  const insertVar = (v: string) => {
    const ta = bodyRef.current;
    if (!ta) { setBody((b) => b + v); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    const next = body.slice(0, start) + v + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + v.length; });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${tpl.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved({ ...tpl, subject, body, isOverridden: true, updatedAt: new Date().toISOString() });
      setSavedTick(true); setTimeout(() => setSavedTick(false), 2000);
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setSaving(false); }
  };

  const reset = async () => {
    if (!confirm('Reset this email to the built-in default? Your edits will be discarded.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${tpl.key}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setSubject(tpl.defaultSubject); setBody(tpl.defaultBody);
      onSaved({ ...tpl, subject: tpl.defaultSubject, body: tpl.defaultBody, isOverridden: false, updatedAt: null });
    } catch (e) {
      alert('Reset failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setSaving(false); }
  };

  const deleteCustom = async () => {
    if (!confirm(`Permanently delete "${tpl.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${tpl.key}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      onDeleted(tpl.key);
    } catch (e) {
      alert('Delete failed: ' + (e instanceof Error ? e.message : String(e)));
      setSaving(false);
    }
  };

  const preview = async () => {
    const res = await fetch(`/api/templates/${tpl.key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, firmSlug: 'gns' }),
    });
    if (!res.ok) { alert('Could not build preview'); return; }
    const html = await res.text();
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject line</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none" />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email body (HTML — wrapped in the firm’s branded shell when sent)</label>
        <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={9}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none resize-y" />
        {tpl.ctaLabel && (
          <p className="text-xs text-gray-400 mt-1">A “{tpl.ctaLabel}” button linking to the secure page is added automatically below your text.</p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Insert a variable</p>
        <div className="flex flex-wrap gap-1.5">
          {variables.map(([v, desc]) => (
            <button key={v} onClick={() => insertVar(v)} title={desc}
              className="text-xs bg-gray-100 hover:bg-purple-100 text-purple-700 px-2 py-1 rounded font-mono transition-colors">
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button onClick={save} disabled={!dirty || saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white disabled:opacity-40 hover:bg-black">
          {saving ? <Loader2 size={14} className="animate-spin" /> : savedTick ? <Check size={14} /> : <Save size={14} />}
          {savedTick ? 'Saved' : 'Save changes'}
        </button>
        <button onClick={preview}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:border-gray-500">
          <Eye size={14} /> Preview
        </button>
        {tpl.isCustom ? (
          <button onClick={deleteCustom} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-red-300 text-red-600 hover:border-red-500 hover:bg-red-50 disabled:opacity-40">
            <Trash2 size={14} /> Delete template
          </button>
        ) : (
          <button onClick={reset} disabled={saving || !tpl.isOverridden}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-500 hover:border-gray-500 disabled:opacity-40">
            <RotateCcw size={14} /> Reset to default
          </button>
        )}
        {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
      </div>
    </div>
  );
}

function NewTemplateForm({ onCreated, onCancel }: { onCreated: (key: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [audience, setAudience] = useState<'Client' | 'Previous Accountant' | 'Firm'>('Previous Accountant');
  const [description, setDescription] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('<p>Dear {directorName},</p>\n<p></p>');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const create = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) { setErr('Name, subject and body are required.'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, audience, description, ctaLabel: ctaLabel || undefined, subject, body }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Create failed');
      const j = await res.json();
      onCreated(j.key);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border-2 border-purple-300 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">New custom template</h3>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clearance Letter — second notice"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none">
            <option value="Previous Accountant">Previous Accountant</option>
            <option value="Client">Client</option>
            <option value="Firm">Firm</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description (shown in the list)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When is this used?"
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject line</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email body (HTML)</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none resize-y" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Button label (optional)</label>
        <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="e.g. Respond to Clearance Request"
          className="mt-1 w-full sm:w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none" />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={create} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white disabled:opacity-40 hover:bg-black">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create template
        </button>
        <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:border-gray-500">
          Cancel
        </button>
      </div>
    </div>
  );
}

function EmailsTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [variables, setVariables] = useState<Array<[string, string]>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/templates');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTemplates(data.templates); setVariables(data.variables);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center gap-2 text-gray-500 text-sm py-8"><Loader2 size={16} className="animate-spin" /> Loading templates…</div>;
  if (error) return <div className="text-red-600 text-sm py-8">Could not load templates: {error}</div>;

  const onSaved = (t: EmailTemplate) => setTemplates((prev) => prev.map((p) => p.key === t.key ? t : p));
  const onDeleted = (key: string) => { setTemplates((prev) => prev.filter((p) => p.key !== key)); setOpen(null); };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4 mb-2">
        <p className="text-sm text-gray-500">
          Edit the wording of every email the platform sends. Changes apply to all future sends. Use the variable chips to merge in client and firm details.
        </p>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 flex-shrink-0">
            <Plus size={14} /> New template
          </button>
        )}
      </div>

      {creating && (
        <NewTemplateForm
          onCancel={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}

      {templates.map((t) => {
        const isOpen = open === t.key;
        return (
          <div key={t.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <button onClick={() => setOpen(isOpen ? null : t.key)}
              className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-gray-50">
              <div className="flex items-start gap-3 min-w-0">
                <Mail size={18} className="text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                    {t.name}
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{t.audience}</span>
                    {t.isCustom && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Custom</span>}
                    {!t.isCustom && t.isOverridden && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">Edited</span>}
                  </p>
                  <p className="text-sm text-gray-500">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-1 font-mono truncate">Subject: {t.subject}</p>
                </div>
              </div>
              <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <EmailEditor tpl={t} variables={variables} onSaved={onSaved} onDeleted={onDeleted} />}
          </div>
        );
      })}
    </div>
  );
}

const VARIABLES: Array<{ group: string; vars: Array<[string, string]> }> = [
  {
    group: 'Firm (per firm — GNS / LLP / Galaxy)',
    vars: [
      ['firm.legalName', 'Full legal name, e.g. GNS Associates Limited'],
      ['firm.name', 'Short name, e.g. GNS Associates'],
      ['firm.address / city / postcode', 'Registered office address'],
      ['firm.email / phone / website', 'Firm contact details'],
      ['firm.regBody', 'Professional body — ACCA or ICAEW'],
      ['firm.partnerName / partnerTitle', 'Default signing partner'],
      ['firm.nestOrgName / nestDelegateId', 'NEST pension delegation details'],
      ['firm.mtdEmail', 'Address for MTD software invites'],
      ['firm.accentColor / logo', 'Brand colour and logo'],
    ],
  },
  {
    group: 'Client & Company',
    vars: [
      ['companyName', 'Client company name'],
      ['companyNumber', 'Companies House number'],
      ['clientAddress', 'Registered office (from Companies House)'],
      ['directorName', 'Signing director'],
      ['clientEmail', 'Director / client email'],
      ['ch.status / incorporationDate / aaDue / csDue / sicCodes', 'Live Companies House details'],
    ],
  },
  {
    group: 'Engagement & Fees',
    vars: [
      ['partnerName', 'Acting partner chosen for this letter'],
      ['regBody', 'ACCA or ICAEW letter body chosen'],
      ['services[]', 'Selected monthly services and prices'],
      ['customFees[]', 'Catch-up / ad-hoc fee lines'],
      ['scopeRows[]', 'Editable coverage thresholds'],
      ['totalMonthly / totalOneoff / annual', 'Calculated fee totals'],
      ['expiresAt', '30-day link expiry date'],
      ['engagementUrl', 'Secure signing link'],
    ],
  },
  {
    group: 'Signature & Clearance',
    vars: [
      ['signatureName / signedAt', 'Typed e-signature and timestamp'],
      ['documentSha256 / ipAddress', 'Audit-report fingerprint & IP'],
      ['prevFirmName / prevEmail / prevPhone', 'Previous accountant details'],
      ['docItems[] (outstanding / received)', 'Clearance documents & status'],
      ['chaseNumber / nextChaseAt', 'Follow-up counter and schedule'],
    ],
  },
];

export default function TemplatesPage() {
  const [tab, setTab] = useState<Tab>('emails');

  const letters: TemplateCard[] = [
    { name: 'Engagement Letter (ACCA)', when: 'The signable contract for ACCA-regulated firms', icon: <FileText size={18} className="text-red-600" />, preview: () => previewLetter('ACCA') },
    { name: 'Engagement Letter (ICAEW)', when: 'The signable contract for ICAEW-regulated firms', icon: <FileText size={18} className="text-blue-700" />, preview: () => previewLetter('ICAEW') },
    { name: 'Signed Copy + Final Audit Report', when: 'Generated automatically when a client e-signs — contract plus the signature certificate (agreement history, IP, SHA-256)', icon: <FileSignature size={18} className="text-green-600" /> },
    { name: 'Professional Clearance Request', when: 'Sent to the previous accountant when a client signs (or via details-only) — matches the LLP clearance template', icon: <Handshake size={18} className="text-indigo-600" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Templates &amp; Email Variables</h1>
        <p className="text-sm text-gray-500 mt-1">
          Edit the emails the platform sends, preview every letter, and see the merge variables available across them.
        </p>
      </div>

      <div className="flex gap-1 border border-gray-200 rounded-xl p-1 bg-white w-fit">
        {([['emails', 'Emails', Mail], ['letters', 'Letters', FileText], ['variables', 'Variables', Braces]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === k ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'emails' && <EmailsTab />}

      {tab === 'variables' && (
        <div className="space-y-5">
          {VARIABLES.map((g) => (
            <div key={g.group} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="font-semibold text-gray-900 text-sm">{g.group}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {g.vars.map(([v, desc]) => (
                  <div key={v} className="px-5 py-2.5 flex items-start gap-4">
                    <code className="text-xs bg-gray-100 text-purple-700 px-2 py-1 rounded font-mono whitespace-nowrap">{`{${v}}`}</code>
                    <span className="text-sm text-gray-600">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">
            Firm-level values (addresses, partners, NEST IDs, brand) are configured per firm. Email wording is editable on the Emails tab. Letter wording lives in the letter engine — tell me what to change and I&apos;ll update the master template.
          </p>
        </div>
      )}

      {tab === 'letters' && (
        <div className="space-y-2">
          {letters.map((t) => (
            <div key={t.name} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5">{t.icon}</div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.when}</p>
                </div>
              </div>
              {t.preview && (
                <button onClick={t.preview} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-500 flex-shrink-0">
                  <Eye size={13} /> Preview
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
