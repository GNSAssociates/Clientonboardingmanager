'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  Upload, CheckCircle2, AlertCircle, FileText, X, Eye, Loader2,
  ShieldCheck, Clock, ChevronDown, ChevronUp, Info, Send,
  IdCard, Building2, Receipt, CreditCard, KeyRound,
  type LucideIcon,
} from 'lucide-react';
import type { DocType } from '@/lib/document-types';

interface DocStatus extends DocType {
  status: 'pending' | 'uploaded' | 'rejected';
  fileName: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
}

interface PageData {
  companyName: string;
  companyNumber: string;
  directorName: string;
  firmSlug: string;
  docs: DocStatus[];
  summary: {
    total: number;
    required: number;
    uploaded: number;
    missingRequired: string[];
    isComplete: boolean;
  };
}

const FIRM_ACCENTS: Record<string, string> = {
  gns: '#cc2229',
  llp: '#1e3a8a',
  galaxy: '#7c3aed',
};

type CategoryMeta = { Icon: LucideIcon; label: string; desc: string };

const CATEGORY_META: Record<string, CategoryMeta> = {
  identity: { Icon: IdCard, label: 'Identity Verification', desc: 'Government-issued ID and proof of address' },
  company: { Icon: Building2, label: 'Company Documents', desc: 'Official Companies House documents' },
  tax: { Icon: Receipt, label: 'Tax References', desc: 'HMRC reference numbers and certificates' },
  financial: { Icon: CreditCard, label: 'Financial Records', desc: 'Bank statements and financial records' },
  access: { Icon: KeyRound, label: 'System Access', desc: 'Software and portal access credentials' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function UploadCard({
  doc,
  accent,
  onUpload,
  onRemove,
}: {
  doc: DocStatus;
  accent: string;
  onUpload: (docType: string, file: File) => void;
  onRemove: (docType: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLocalError('');
    const maxBytes = doc.maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setLocalError(`File too large. Maximum: ${doc.maxSizeMb}MB`);
      return;
    }
    const accepted = doc.acceptedFormats;
    if (!accepted.includes(file.type) && file.type !== 'application/octet-stream') {
      setLocalError('File type not accepted. Please use PDF, JPG, or PNG.');
      return;
    }
    setUploading(true);
    try {
      await onUpload(doc.id, file);
    } finally {
      setUploading(false);
    }
  };

  const isUploaded = doc.status === 'uploaded';
  const isRequired = doc.required;

  return (
    <div className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${
      isUploaded
        ? 'border-green-200 bg-green-50/30'
        : dragging
        ? 'border-dashed bg-blue-50/50'
        : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
    }`}
      style={dragging ? { borderColor: accent } : {}}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Status icon */}
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
            isUploaded ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {isUploaded
              ? <CheckCircle2 size={18} className="text-green-600" />
              : <FileText size={18} className="text-gray-400" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">{doc.label}</p>
              {isRequired && !isUploaded && (
                <span className="px-1.5 py-0.5 text-xs font-medium text-red-700 bg-red-50 rounded-full border border-red-100">
                  Required
                </span>
              )}
              {!isRequired && (
                <span className="px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-gray-50 rounded-full border border-gray-200">
                  Optional
                </span>
              )}
              {isUploaded && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-green-700 bg-green-50 rounded-full border border-green-100">
                  <CheckCircle2 size={11} aria-hidden="true" /> Uploaded
                </span>
              )}
            </div>

            {isUploaded && doc.fileName ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 min-w-0 px-3 py-1.5 bg-green-100 rounded-lg border border-green-200 flex items-center gap-2">
                  <FileText size={13} className="text-green-600 flex-shrink-0" />
                  <span className="text-xs text-green-800 font-medium truncate">{doc.fileName}</span>
                  {doc.fileSizeBytes && (
                    <span className="text-xs text-green-600 flex-shrink-0">({formatBytes(doc.fileSizeBytes)})</span>
                  )}
                </div>
                {doc.fileUrl && (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    aria-label={`View uploaded file for ${doc.label}`}
                    className="flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-lg bg-green-100 hover:bg-green-200 transition-colors">
                    <Eye size={15} className="text-green-600" aria-hidden="true" />
                  </a>
                )}
                <button type="button" onClick={() => onRemove(doc.id)}
                  aria-label={`Remove uploaded file for ${doc.label}`}
                  className="flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
                  <X size={15} className="text-red-500" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                aria-label={`Upload ${doc.label} — drop a file here or press Enter to browse`}
                className={`mt-2 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                style={dragging ? { borderColor: accent } : undefined}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <Loader2 size={14} className="animate-spin text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">Uploading…</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <Upload size={13} style={{ color: accent }} />
                    <span className="text-xs font-medium" style={{ color: accent }}>
                      Drop file here or click to browse
                    </span>
                  </div>
                )}
                <input ref={inputRef} type="file"
                  accept={doc.acceptedFormats.join(',')}
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
            )}

            {localError && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={11} /> {localError}
              </p>
            )}
          </div>

          {/* Expand hint */}
          <button type="button" onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? `Hide details for ${doc.label}` : `Show details for ${doc.label}`}
            className="flex items-center justify-center w-8 h-8 flex-shrink-0 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors mt-0.5">
            {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 ml-12 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-600 mb-1">{doc.description}</p>
            <div className="flex items-start gap-1 mt-1.5">
              <Info size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{doc.hint}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Accepted: {doc.acceptedFormats.map((f) => f.split('/')[1]?.toUpperCase()).join(', ')} · Max {doc.maxSizeMb}MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DocumentUploadPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const accent = data ? (FIRM_ACCENTS[data.firmSlug] ?? '#cc2229') : '#cc2229';

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${token}`);
      if (!res.ok) throw new Error('Not found');
      const json = await res.json();
      setData(json);
    } catch {
      setPageError('This document upload link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async (docType: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('docType', docType);
    const res = await fetch(`/api/documents/${token}/upload`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }
    await loadDocs();
  };

  const handleRemove = async (docType: string) => {
    await fetch(`/api/documents/${token}/upload`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType }),
    });
    await loadDocs();
  };

  const handleSubmit = async () => {
    if (!data?.summary.isComplete) return;
    setSubmitLoading(true);
    await new Promise((r) => setTimeout(r, 500)); // brief pause for effect
    setSubmitLoading(false);
    setSubmitted(true);
  };

  if (loading) return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 size={36} className="animate-spin text-blue-400 mx-auto mb-4" />
        <p className="text-sm text-gray-500">Loading your document portal…</p>
      </div>
    </div>
  );

  if (pageError) return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md bg-white rounded-2xl p-10 shadow text-center">
        <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link Not Found</h1>
        <p className="text-gray-500">{pageError}</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg bg-white rounded-2xl p-10 shadow-lg text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="text-green-600" size={36} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">All Documents Submitted!</h1>
        <p className="text-gray-600 mb-6">
          Thank you, <strong>{data?.directorName || 'Director'}</strong>. All required documents for
          <strong> {data?.companyName}</strong> have been received. Our team will review them and be in
          touch within 2 business days.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 text-left space-y-2">
          <p className="font-semibold">What happens next?</p>
          <p>✓ Our team will verify your identity documents</p>
          <p>✓ We will set up your accounts on HMRC and Companies House portals</p>
          <p>✓ You will receive a confirmation email with next steps</p>
        </div>
      </div>
    </div>
  );

  if (!data) return null;

  const { docs, summary } = data;
  const byCategory = docs.reduce<Record<string, DocStatus[]>>((acc, d) => {
    acc[d.category] = [...(acc[d.category] || []), d];
    return acc;
  }, {});

  const pct = Math.min(100, Math.round((summary.uploaded / summary.required) * 100));
  const requiredRemaining = summary.missingRequired.length;

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 relative flex-shrink-0">
              <Image src="/logos/gns.png" alt="GNS" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{data.companyName}</p>
              <p className="text-xs text-gray-500">Document Upload Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: accent }}>
                {summary.uploaded}/{summary.required} required
              </p>
              <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, #1e3a8a)` }} />
              </div>
            </div>
            {summary.isComplete && (
              <button
                onClick={handleSubmit}
                disabled={submitLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-bold transition-all hover:shadow-lg"
                style={{ background: `linear-gradient(135deg, ${accent}, #1e3a8a)` }}
              >
                {submitLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Submit All
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Hero card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${accent}, #1e3a8a)` }} />
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: accent + '18' }}>
                <ShieldCheck size={24} style={{ color: accent }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Document Verification Portal</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {data.companyName} ({data.companyNumber}) · {data.directorName}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">
              To complete your onboarding with us, please upload the required documents below. All files
              are stored securely and encrypted. Accepted formats: <strong>PDF, JPG, PNG</strong>.
            </p>

            {/* Progress */}
            <div className="mt-5">
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span className="text-gray-500">Overall Progress</span>
                <span style={{ color: accent }}>{pct}% complete</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, #1e3a8a)` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1.5">
                <span>{summary.uploaded} documents received</span>
                <span>{requiredRemaining} required still needed</span>
              </div>
            </div>

            {/* Status banner */}
            {summary.isComplete ? (
              <div className="mt-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-green-800">
                  All required documents received — click &ldquo;Submit All&rdquo; above to complete.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Clock size={16} className="text-amber-600 flex-shrink-0" />
                <p className="text-sm font-medium text-amber-800">
                  {requiredRemaining} required document{requiredRemaining !== 1 ? 's' : ''} still needed before we can proceed.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Document categories */}
        {Object.entries(byCategory).map(([category, catDocs]) => {
          const meta = CATEGORY_META[category];
          const CatIcon = meta?.Icon;
          return (
          <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-gray-100 flex items-start gap-3">
              {CatIcon && (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: accent + '14' }}>
                  <CatIcon size={17} style={{ color: accent }} aria-hidden="true" />
                </div>
              )}
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  {meta?.label ?? category}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {meta?.desc ?? ''}
                </p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {catDocs.map((doc) => (
                <UploadCard
                  key={doc.id}
                  doc={doc}
                  accent={accent}
                  onUpload={handleUpload}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </div>
          );
        })}

        {/* Security note */}
        <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500">
          <ShieldCheck size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            All documents are encrypted and stored securely. We comply with GDPR and only use your documents
            for the purposes of completing your accounting onboarding. Files are accessible only to authorised
            members of the {data.firmSlug === 'llp' ? 'GNS Associates UK LLP' : 'GNS Associates'} team.
          </p>
        </div>

        {/* Sticky submit at bottom */}
        {summary.isComplete && (
          <div className="sticky bottom-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <button
              onClick={handleSubmit}
              disabled={submitLoading}
              className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:shadow-2xl hover:scale-[1.01] flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${accent}, #1e3a8a)` }}
            >
              {submitLoading
                ? <><Loader2 size={18} className="animate-spin" /> Submitting…</>
                : <><CheckCircle2 size={18} /> Submit All Documents — Proceed to Next Step</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
