'use client';

import { useState } from 'react';
import { ShieldCheck, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface KycExtract {
  documentType: string | null; fullName: string | null; dateOfBirth: string | null;
  documentNumber: string | null; issuingCountry: string | null; expiryDate: string | null; legible: boolean;
}
interface KycResult {
  ok: boolean; error?: string; extract?: KycExtract;
  nameMatch?: boolean | null; dobMatch?: boolean | null; expired?: boolean | null; notes?: string[];
}

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => { const s = String(r.result || ''); const i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s); };
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

function Flag({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value === null || value === undefined) return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400"><AlertTriangle size={12} /> {label}: n/a</span>
  );
  return value
    ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={12} /> {label}</span>
    : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><XCircle size={12} /> {label}</span>;
}

export default function KycPanel({ expectedName }: { token: string; expectedName?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KycResult | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const onFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name); setResult(null); setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/onboarding/kyc-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: file.type || 'image/jpeg', expectedName: expectedName || undefined }),
      });
      setResult(await res.json());
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message || 'Upload failed' });
    } finally { setBusy(false); }
  };

  const e = result?.extract;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <ShieldCheck size={16} className="text-emerald-600" /> AI ID Verification (KYC)
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Upload a passport or driving licence — Claude reads it and checks the name{expectedName ? ` against “${expectedName}”` : ''}.
      </p>

      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {busy ? 'Checking…' : 'Upload & verify ID'}
        <input type="file" accept="image/*,application/pdf,.pdf" hidden disabled={busy}
          onChange={(ev) => onFile(ev.target.files?.[0])} />
      </label>
      {fileName && <span className="ml-2 text-xs text-gray-400">{fileName}</span>}

      {result && !result.ok && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">{result.error}</div>
      )}

      {result?.ok && e && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
            <Flag label="Name match" value={result.nameMatch} />
            <Flag label="DOB match" value={result.dobMatch} />
            {result.expired !== null && result.expired !== undefined && (
              result.expired
                ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><XCircle size={12} /> Expired</span>
                : <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={12} /> In date</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            <div><span className="text-gray-400">Type:</span> {e.documentType ?? '—'}</div>
            <div><span className="text-gray-400">Name:</span> {e.fullName ?? '—'}</div>
            <div><span className="text-gray-400">DOB:</span> {e.dateOfBirth ?? '—'}</div>
            <div><span className="text-gray-400">Expiry:</span> {e.expiryDate ?? '—'}</div>
            <div><span className="text-gray-400">Doc no.:</span> {e.documentNumber ?? '—'}</div>
            <div><span className="text-gray-400">Country:</span> {e.issuingCountry ?? '—'}</div>
          </div>
          {result.notes && result.notes.length > 0 && (
            <ul className="mt-3 space-y-1">
              {result.notes.map((n, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {n}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] text-gray-400">AI-assisted check — always confirm against the original document. Not stored by this tool.</p>
        </div>
      )}
    </div>
  );
}
