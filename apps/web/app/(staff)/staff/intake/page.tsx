'use client';

/**
 * Partner intake — the first screen for a new client, and the only place the
 * basics are typed.
 *
 * It is the "New Client Handover — Partner → Sagar" spreadsheet, in the system
 * that actually uses the answers. What is entered here fills the engagement
 * letter, the clearance request to the outgoing accountant, and the handover
 * checklist. Nobody retypes it.
 *
 * Sending is one button when the three things a letter needs are present. The
 * wizard is still there for the cases that need pricing worked through, and it
 * opens already filled in.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  RefreshCw, ChevronLeft, Save, Send, SlidersHorizontal,
  AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import {
  EMPTY_INTAKE, FEE_BASIS_LABELS, CONTACT_METHOD_LABELS,
  intakeBlockers, intakeWarnings,
  type IntakeForm, type FeeBasis, type ContactMethod, type FilledByRole,
} from '@/lib/intake';

const FIRMS: Record<string, string> = {
  gns: 'GNS Associates Limited',
  llp: 'GNS Associates UK LLP',
  galaxy: 'Galaxy Accountants',
};

export default function IntakePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>
      <IntakeInner />
    </Suspense>
  );
}

function IntakeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const existingToken = params.get('token');

  const [f, setF] = useState<IntakeForm>(EMPTY_INTAKE);
  const [token, setToken] = useState<string | null>(existingToken);
  const [loading, setLoading] = useState(Boolean(existingToken));
  const [busy, setBusy] = useState<null | 'save' | 'send' | 'wizard'>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Resume a part-filled form rather than starting a second record for the
  // same client.
  useEffect(() => {
    if (!existingToken) return;
    fetch(`/api/onboarding/intake?token=${existingToken}`)
      .then((r) => r.json())
      .then((j) => { if (j.intake) setF({ ...EMPTY_INTAKE, ...j.intake }); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [existingToken]);

  const set = <K extends keyof IntakeForm>(k: K, v: IntakeForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const setContact = (k: keyof IntakeForm['contact'], v: string) =>
    setF((p) => ({ ...p, contact: { ...p.contact, [k]: v } }));
  const setPrev = (k: keyof IntakeForm['previousAccountant'], v: string) =>
    setF((p) => ({ ...p, previousAccountant: { ...p.previousAccountant, [k]: v } }));

  const blockers = intakeBlockers(f);
  const warnings = intakeWarnings(f);

  const save = useCallback(async (): Promise<string | null> => {
    const res = await fetch('/api/onboarding/intake', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intake: f, token }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Could not save');
    setToken(j.token);
    return j.token as string;
  }, [f, token]);

  const onSave = async () => {
    setBusy('save'); setMsg(null);
    try {
      await save();
      setMsg({ ok: true, text: 'Saved. You can come back to this any time.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save' });
    } finally { setBusy(null); }
  };

  const onOpenWizard = async () => {
    setBusy('wizard'); setMsg(null);
    try {
      const t = await save();
      // The wizard reads the same draft, so it opens with this already in it.
      router.push(`/onboarding/services?draft=${t}`);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save' });
      setBusy(null);
    }
  };

  const onSend = async () => {
    setBusy('send'); setMsg(null);
    try {
      const t = await save();
      const res = await fetch('/api/onboarding/intake/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not send the engagement letter');
      setMsg({
        ok: true,
        text: j.clearanceSent
          ? 'Engagement letter sent, and clearance requested from the outgoing accountant.'
          : 'Engagement letter sent to the client.',
      });
      setTimeout(() => router.push(`/staff/clients/${t}`), 1800);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not send' });
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw size={22} className="animate-spin text-purple-500" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
      <div>
        <Link href="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800">
          <ChevronLeft size={16} /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">New client intake</h1>
        <p className="text-sm text-gray-500">
          Taking a client from another accountant. Fill this once — the engagement letter,
          the clearance request and the handover checklist all read it.
        </p>
      </div>

      {/* Who is filling this in. A partner sold it; staff often write it up. */}
      <Card>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Filled in by</Label>
            <div className="flex gap-1.5 mt-1">
              {(['partner', 'staff'] as FilledByRole[]).map((r) => (
                <button key={r} type="button" onClick={() => set('filledByRole', r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    f.filledByRole === r
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}>
                  {r === 'partner' ? 'Partner' : 'Staff'}
                </button>
              ))}
            </div>
          </div>
          <Text label="Your name" value={f.filledByName} onChange={(v) => set('filledByName', v)} placeholder="Who is typing this" />
          <div>
            <Label>Firm</Label>
            <select value={f.firmSlug} onChange={(e) => set('firmSlug', e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
              {Object.entries(FIRMS).map(([s, l]) => <option key={s} value={s}>{l}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card title="The client">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Text label="Client name" required value={f.clientName} onChange={(v) => set('clientName', v)} placeholder="Acme Trading Ltd" />
          </div>
          <Text label="Company number" hint="limited companies only" value={f.companyNumber} onChange={(v) => set('companyNumber', v)} placeholder="12345678" />
        </div>
        <Text label="Partner who sold the work" value={f.partnerName} onChange={(v) => set('partnerName', v)} placeholder="Mahesh" />
      </Card>

      <Card title="1. Services sold">
        <Text
          label="In your own shorthand"
          hint="kept word for word — it is the record of what was agreed"
          value={f.servicesSold}
          onChange={(v) => set('servicesSold', v)}
          placeholder="AA/CT-£1.5M, VAT, PAYE-12, CIS-15, SA-2"
        />
      </Card>

      <Card title="2. Fee and how it is paid">
        <div className="grid sm:grid-cols-3 gap-3">
          <Text label="Fee" value={f.feeAmount} onChange={(v) => set('feeAmount', v)} placeholder="£500/m" />
          <div className="sm:col-span-2">
            <Label>How it is paid</Label>
            <select value={f.feeBasis} onChange={(e) => set('feeBasis', e.target.value as FeeBasis)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
              {Object.entries(FEE_BASIS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <Text label="Anything else about the fee" value={f.feeNote} onChange={(v) => set('feeNote', v)} placeholder="e.g. first three months at half rate" />
      </Card>

      <Card title="3. Main contact">
        <div className="grid sm:grid-cols-3 gap-3">
          <Text label="Name" value={f.contact.name} onChange={(v) => setContact('name', v)} placeholder="Hary Demo" />
          <Text label="Email" required value={f.contact.email} onChange={(v) => setContact('email', v)} placeholder="hary@acme.co.uk" />
          <Text label="Mobile" value={f.contact.mobile} onChange={(v) => setContact('mobile', v)} placeholder="07700 900000" />
        </div>
        <div>
          <Label>Prefers to be contacted by</Label>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {(Object.keys(CONTACT_METHOD_LABELS) as ContactMethod[]).map((m) => (
              <button key={m} type="button" onClick={() => setContact('preferred', m)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  f.contact.preferred === m
                    ? 'bg-gray-900 border-gray-900 text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                }`}>
                {CONTACT_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="4. Catch-up work" subtitle="Work already behind. This is what most often turns a clean onboarding into a three-month one.">
        <Text label="What is outstanding" value={f.catchupWork} onChange={(v) => set('catchupWork', v)} placeholder="YE 2025 still to do; VAT quarters behind" />
        <Text label="Catch-up fee" hint="charged as a one-off in the letter, separate from the monthly fee" value={f.catchupFee} onChange={(v) => set('catchupFee', v)} placeholder="£1500+VAT" />
      </Card>

      <Card title="5. Previous accountant" subtitle="Clearance goes to them the moment the client signs — with their email it is automatic.">
        <div className="grid sm:grid-cols-2 gap-3">
          <Text label="Firm name" value={f.previousAccountant.firmName} onChange={(v) => setPrev('firmName', v)} placeholder="Xenadin X Ltd" />
          <Text label="Email" value={f.previousAccountant.email} onChange={(v) => setPrev('email', v)} placeholder="info@xenadin.co.uk" />
          <Text label="Full address" value={f.previousAccountant.address} onChange={(v) => setPrev('address', v)} placeholder="123 HB Road, UB9" />
          <Text label="Phone" value={f.previousAccountant.phone} onChange={(v) => setPrev('phone', v)} placeholder="01895 000000" />
        </div>
      </Card>

      <Card title="6. Anything sensitive we must know">
        <textarea
          value={f.sensitiveNotes}
          onChange={(e) => set('sensitiveNotes', e.target.value)}
          rows={2}
          placeholder="Pending VAT investigation, CIS refund due, QBO needs cleaning…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
        <p className="text-[11px] text-gray-500">This is carried into the engagement letter as a special term.</p>
      </Card>

      {/* What is missing, split by whether it stops the send. */}
      {blockers.length > 0 && (
        <Notice tone="amber" icon={<AlertTriangle size={14} />}>
          Before this can be sent: {blockers.join(', ')}.
        </Notice>
      )}
      {blockers.length === 0 && warnings.length > 0 && (
        <Notice tone="blue" icon={<Info size={14} />}>
          <span className="font-semibold">Can be sent, but worth a look:</span>
          <ul className="list-disc ml-4 mt-0.5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Notice>
      )}
      {msg && (
        <Notice tone={msg.ok ? 'green' : 'red'} icon={msg.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}>
          {msg.text}
        </Notice>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap pb-8">
        <button onClick={onSave} disabled={busy !== null || !f.clientName.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
          {busy === 'save' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Save for later
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onOpenWizard} disabled={busy !== null || !f.clientName.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            title="For pricing that needs working through — it opens already filled in">
            {busy === 'wizard' ? <RefreshCw size={14} className="animate-spin" /> : <SlidersHorizontal size={14} />}
            Price it in the wizard
          </button>
          <button onClick={onSend} disabled={busy !== null || blockers.length > 0}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
            {busy === 'send' ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {busy === 'send' ? 'Sending…' : 'Send engagement letter'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── small pieces ─────────────────────────────────────────────────────── */

function Card({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {title && (
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-gray-800">{children}</label>;
}

function Text({
  label, value, onChange, placeholder, hint, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; required?: boolean }) {
  return (
    <div>
      <Label>
        {label}{required && <span className="text-red-600"> *</span>}
        {hint && <span className="font-normal text-gray-400"> — {hint}</span>}
      </Label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
    </div>
  );
}

function Notice({
  tone, icon, children,
}: { tone: 'amber' | 'blue' | 'green' | 'red'; icon: React.ReactNode; children: React.ReactNode }) {
  const styles = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    red: 'border-red-200 bg-red-50 text-red-900',
  }[tone];
  return (
    <div className={`rounded-lg border px-3 py-2 flex items-start gap-2 text-xs ${styles}`}>
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}
