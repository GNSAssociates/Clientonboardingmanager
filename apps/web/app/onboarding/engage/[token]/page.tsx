'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, Clock, CheckCircle2, FileText, Lock, ChevronDown, ChevronUp, Upload, ShieldCheck } from 'lucide-react';
import { getFirm } from '@/lib/firms';

// Documents the DIRECTOR personally provides (KYC / ID), chosen via dropdown at
// signing. "ready" → upload immediately after signing; "later" → we email the
// director every 2 days; "na" → requested from the previous accountant instead.
const DIRECTOR_DOCS = [
  { id: 'photo_id', label: 'Photo ID', description: 'Passport or driving licence' },
  { id: 'proof_address', label: 'Proof of Address', description: 'Utility bill or bank statement (less than 3 months old)' },
];

const DOC_STATUS_OPTIONS = [
  { value: 'ready', label: 'I have this ready to upload' },
  { value: 'later', label: "I'll send this within a few days" },
  { value: 'na', label: 'Not applicable — request from my previous accountant' },
];

const CONTACT_PREFS = [
  { id: 'post', label: 'Post' },
  { id: 'email', label: 'Email' },
  { id: 'telephone', label: 'Telephone' },
  { id: 'text', label: 'Text message' },
  { id: 'automated_call', label: 'Automated call' },
];

interface OnboardingLinkData {
  id: string;
  companyName: string;
  companyNumber: string;
  clientEmail: string;
  directorName: string;
  firmSlug: string;
  services: Array<{ id: string; name: string; price: number; oneoff?: boolean }>;
  expiresAt: string;
  status: string;
  letterMeta?: { sendMode?: string } | null;
}

export default function EngagementPage() {
  const params = useParams();
  const token = params.token as string;

  const [link, setLink] = useState<OnboardingLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ signedLetterUrl?: string | null; uploadUrl?: string; mode?: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [letterHeight, setLetterHeight] = useState(1200);

  // Previous accountant fields
  const [prevFirmName, setPrevFirmName] = useState('');
  const [prevEmail, setPrevEmail] = useState('');
  const [prevPhone, setPrevPhone] = useState('');
  const [noPrevAccountant, setNoPrevAccountant] = useState(false);

  // Director ID document statuses
  const [docStatus, setDocStatus] = useState<Record<string, string>>({});

  // Declaration + typed signature + e-sign consent
  const [authorised, setAuthorised] = useState(false);
  const [esignConsent, setEsignConsent] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  // Direct debit mandate details (compulsory)
  const [ddName, setDdName] = useState('');
  const [ddAccountNo, setDdAccountNo] = useState('');
  const [ddSortCode, setDdSortCode] = useState('');
  const [ddBankAddress, setDdBankAddress] = useState('');

  // Contact preferences (Data Protection section (c))
  const [contactPrefs, setContactPrefs] = useState<Record<string, boolean>>({ email: true });

  const [docsExpanded, setDocsExpanded] = useState(true);

  useEffect(() => {
    fetch(`/api/onboarding/links/${token}`)
      .then((r) => r.json())
      .then((data) => {
        setLink(data);
        if (data?.directorName) setSignatureName(data.directorName);
      })
      .catch(() => setPageError('Link not found or invalid'))
      .finally(() => setLoading(false));
  }, [token]);

  // Auto-size the letter iframe to its content
  const onLetterLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc?.body) setLetterHeight(doc.body.scrollHeight + 60);
    } catch { /* cross-origin never happens (same origin) */ }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading your engagement letter...</p>
      </div>
    </div>
  );

  if (pageError || !link || !link.companyName) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-xl w-full bg-white rounded-2xl p-10 shadow-lg text-center">
        <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Not Found</h1>
        <p className="text-gray-600">This onboarding link is invalid or has expired. Please contact us.</p>
      </div>
    </div>
  );

  const mode = link.letterMeta?.sendMode === 'details_only' ? 'details_only' : 'engagement';
  const expiresAt = new Date(link.expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft <= 0;
  const isExpiringSoon = daysLeft > 0 && daysLeft <= 7;
  const firm = getFirm(link.firmSlug || 'gns');
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const ddValid = ddName.trim().length > 1
    && ddAccountNo.replace(/\D/g, '').length >= 6
    && ddSortCode.replace(/\D/g, '').length === 6;

  const prevOk = noPrevAccountant || (prevFirmName && prevEmail && prevPhone);

  const canSubmit = mode === 'details_only'
    ? Boolean(prevOk && !isExpired && !noPrevAccountant ? (prevFirmName && prevEmail) : prevOk) && !isExpired
    : Boolean(authorised && esignConsent && signatureName.trim().length > 1 && prevOk && ddValid) && !isExpired;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/onboarding/links/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prevFirmName: noPrevAccountant ? null : prevFirmName,
          prevEmail: noPrevAccountant ? null : prevEmail,
          prevPhone: noPrevAccountant ? null : prevPhone,
          noPrevAccountant,
          directorDocs: DIRECTOR_DOCS.map((d) => ({ id: d.id, label: d.label, status: docStatus[d.id] || 'later' })),
          signatureName: signatureName.trim(),
          contactPrefs: CONTACT_PREFS.filter((p) => contactPrefs[p.id]).map((p) => p.id),
          directDebit: mode === 'engagement' ? {
            accountName: ddName, accountNumber: ddAccountNo, sortCode: ddSortCode, bankAddress: ddBankAddress,
          } : null,
          authorised: mode === 'details_only' ? true : authorised,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Submission failed');
      setResult(data as { signedLetterUrl?: string | null; uploadUrl?: string; mode?: string });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const anyReady = DIRECTOR_DOCS.some((d) => (docStatus[d.id] || 'later') === 'ready');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-10">
        <div className="max-w-xl w-full bg-white rounded-2xl p-10 shadow-lg text-center">
          <div className="inline-flex mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-40" />
              <CheckCircle2 className="text-green-500 relative" size={72} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {mode === 'details_only' ? 'Details Received!' : 'Contract Signed!'}
          </h1>
          <p className="text-gray-600 mb-6">
            Thank you, <strong>{signatureName || link.directorName}</strong>.
            {mode === 'details_only'
              ? ' We will contact your previous accountant to arrange the professional handover.'
              : ` Your contract with ${firm.legalName} has been signed and confirmed.`}
          </p>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-left space-y-2 mb-6">
            <p className="text-sm text-gray-700">✅ Confirmation sent to <strong>{link.clientEmail}</strong></p>
            {!noPrevAccountant && prevEmail && (
              <p className="text-sm text-gray-700">✅ Professional clearance request sent to <strong>{prevEmail}</strong></p>
            )}
            <p className="text-sm text-gray-700">✅ {firm.name} has been notified</p>
          </div>

          {mode === 'engagement' && (
            <div className="space-y-3">
              {anyReady && result?.uploadUrl && (
                <a
                  href={result.uploadUrl}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${firm.accentColor}, #1e3a8a)` }}
                >
                  <Upload size={18} /> Upload your ID documents now
                </a>
              )}
              {result?.signedLetterUrl && (
                <a
                  href={result.signedLetterUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold border-2 border-gray-300 text-gray-700 hover:border-gray-400"
                >
                  <FileText size={18} /> View / download your signed contract
                </a>
              )}
            </div>
          )}
          <p className="text-sm text-gray-500 mt-5">A member of our team will be in touch within 2 business days.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 py-10 px-4">
      <div className={`${mode === 'details_only' ? 'max-w-xl' : 'max-w-4xl'} mx-auto space-y-6`}>

        {/* Expiry banners */}
        {isExpired && (
          <div className="p-4 bg-red-600 text-white rounded-xl flex items-start gap-3">
            <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold">This link has expired</p>
              <p className="text-sm opacity-90 mt-1">Expired on {expiresAt.toLocaleDateString('en-GB')}. Please contact {firm.name} for a new link.</p>
            </div>
          </div>
        )}
        {isExpiringSoon && !isExpired && (
          <div className="p-4 bg-red-50 border-2 border-red-500 rounded-xl flex items-start gap-3">
            <Clock className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-red-900">Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
              <p className="text-sm text-red-700 mt-1">Please complete this before {expiresAt.toLocaleDateString('en-GB')}.</p>
            </div>
          </div>
        )}

        {/* ═══════ MODE: DETAILS ONLY — short form, no contract ═══════ */}
        {mode === 'details_only' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Previous Accountant Details</h1>
              <p className="text-sm text-gray-500 mb-6">
                {firm.legalName} needs these details to request professional clearance and the handover of the records
                for <strong>{link.companyName}</strong>.
              </p>

              <label className="flex items-center gap-3 mb-5 cursor-pointer">
                <input type="checkbox" checked={noPrevAccountant} onChange={(e) => setNoPrevAccountant(e.target.checked)} className="w-4 h-4 rounded text-purple-600" />
                <span className="text-sm text-gray-700">I do not have a previous accountant / this is a new business</span>
              </label>

              {!noPrevAccountant && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Previous Accountant Firm Name *</label>
                    <input type="text" value={prevFirmName} onChange={(e) => setPrevFirmName(e.target.value)} required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Their Email Address *</label>
                    <input type="email" value={prevEmail} onChange={(e) => setPrevEmail(e.target.value)} required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Their Phone Number *</label>
                    <input type="tel" value={prevPhone} onChange={(e) => setPrevPhone(e.target.value)} required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                </div>
              )}
            </div>

            {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl"><p className="text-sm text-red-700">{error}</p></div>}

            <button type="submit" disabled={!canSubmit || submitting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${canSubmit ? 'text-white hover:shadow-xl' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              style={canSubmit ? { background: `linear-gradient(135deg, ${firm.accentColor}, #1e3a8a)` } : {}}>
              {submitting ? 'Submitting...' : 'Submit Details'}
            </button>
          </form>
        ) : (
        <>
        {/* ═══════ THE CONTRACT — canonical letter document ═══════ */}
        <div className="bg-white shadow-lg border border-gray-300 rounded-sm overflow-hidden">
          <iframe
            ref={iframeRef}
            src={`/api/onboarding/links/${token}/letter`}
            onLoad={onLetterLoad}
            style={{ width: '100%', height: letterHeight, border: 0 }}
            title="Engagement Letter"
          />
        </div>

        {/* ═══════ ACCEPTANCE / SIGNING ═══════ */}
        {!isExpired && (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Previous Accountant */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Previous Accountant Details</h2>
              <p className="text-sm text-gray-500 mb-5">We need these details to request professional clearance and your records on your behalf.</p>

              <label className="flex items-center gap-3 mb-5 cursor-pointer">
                <input type="checkbox" checked={noPrevAccountant} onChange={(e) => setNoPrevAccountant(e.target.checked)} className="w-4 h-4 rounded text-purple-600" />
                <span className="text-sm text-gray-700">I do not have a previous accountant / this is a new business</span>
              </label>

              {!noPrevAccountant && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Previous Accountant Firm Name *</label>
                    <input type="text" value={prevFirmName} onChange={(e) => setPrevFirmName(e.target.value)} placeholder="e.g., Smith & Associates Ltd" required={!noPrevAccountant}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Their Email Address *</label>
                    <input type="email" value={prevEmail} onChange={(e) => setPrevEmail(e.target.value)} placeholder="contact@previousfirm.com" required={!noPrevAccountant}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Their Phone Number *</label>
                    <input type="tel" value={prevPhone} onChange={(e) => setPrevPhone(e.target.value)} placeholder="+44 20 1234 5678" required={!noPrevAccountant}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    Once you sign, we will automatically contact your previous accountant requesting professional clearance and the handover of your accounting records.
                  </div>
                </div>
              )}
            </div>

            {/* Director ID documents */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button type="button" onClick={() => setDocsExpanded(!docsExpanded)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="text-purple-600" size={22} />
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Your ID Documents</h2>
                    <p className="text-sm text-gray-500">Required for anti-money-laundering (KYC) checks — you don&apos;t need them ready to sign.</p>
                  </div>
                </div>
                {docsExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </button>

              {docsExpanded && (
                <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                  <div className="space-y-3">
                    {DIRECTOR_DOCS.map((doc) => {
                      const st = docStatus[doc.id] || 'later';
                      return (
                        <div key={doc.id} className="p-3 rounded-lg border border-gray-100">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{doc.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                            </div>
                            <select value={st} onChange={(e) => setDocStatus((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                              className="flex-shrink-0 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                              {DOC_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          {st === 'ready' && (
                            <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                              <Upload size={12} /> Great — you&apos;ll be taken to the secure upload page right after signing.
                            </p>
                          )}
                          {st === 'later' && (
                            <p className="text-xs text-amber-700 mt-2">We&apos;ll email you a secure upload link and remind you every 2 days until received.</p>
                          )}
                          {st === 'na' && (
                            <p className="text-xs text-blue-700 mt-2">We&apos;ll request this from your previous accountant as part of professional clearance.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Direct Debit — compulsory */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-300">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Direct Debit Details (GoCardless) *</h2>
              <p className="text-sm text-gray-500 mb-5">
                Required to complete the contract — your monthly fees are collected by Direct Debit, protected by the Direct Debit Guarantee.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Account Holder&apos;s Name *</label>
                  <input type="text" value={ddName} onChange={(e) => setDdName(e.target.value)} required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Account Number *</label>
                  <input type="text" inputMode="numeric" maxLength={8} value={ddAccountNo}
                    onChange={(e) => setDdAccountNo(e.target.value.replace(/\D/g, ''))} required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Sort Code *</label>
                  <input type="text" inputMode="numeric" maxLength={8} placeholder="00-00-00" value={ddSortCode}
                    onChange={(e) => setDdSortCode(e.target.value)} required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Address as per Bank</label>
                  <input type="text" value={ddBankAddress} onChange={(e) => setDdBankAddress(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-4 leading-relaxed">
                I authorise {firm.name} to collect my fees using GoCardless direct debit and I hereby authorise the use of my
                above bank details for direct debit setup on my behalf. Your details are transmitted securely and used solely
                for the Direct Debit mandate.
              </p>
            </div>

            {/* Contact preferences */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Contact Preferences</h2>
              <p className="text-sm text-gray-500 mb-4">
                From time to time we would like to contact you with details of other services we provide. Select the ways you consent to being contacted:
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {CONTACT_PREFS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!contactPrefs[p.id]}
                      onChange={(e) => setContactPrefs((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                      className="w-4 h-4 rounded text-purple-600" />
                    <span className="text-sm text-gray-800">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Declaration + E-Signature */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="text-purple-600" size={22} />
                <h2 className="text-lg font-bold text-gray-900">Client Declaration &amp; Electronic Signature</h2>
              </div>

              <div className="bg-white rounded-xl p-5 mb-5 border border-purple-200">
                <p className="text-gray-800 leading-relaxed text-sm">
                  I, <strong>{signatureName || link.directorName || 'the undersigned'}</strong>, being a Director of{' '}
                  <strong>{link.companyName}</strong> (Company No. {link.companyNumber}), confirm that I have read this
                  contract to the last page and I am happy to proceed. I hereby authorise <strong>{firm.legalName}</strong> to
                  act as the company&apos;s accountants and to take over all accountancy work with effect from the date of this
                  agreement, and I agree to the terms of this letter, the schedule(s) of services, the privacy notice and the
                  standard terms and conditions.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer mb-3">
                <input type="checkbox" checked={authorised} onChange={(e) => setAuthorised(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-400 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900">
                    I have read and understood the contract in its entirety and authorise {firm.name} to take over all my accountancy work
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <input type="checkbox" checked={esignConsent} onChange={(e) => setEsignConsent(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-400 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-purple-600" /> I agree to sign this contract electronically
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    I understand that typing my name below constitutes my legal electronic signature, with the same legal
                    effect as a handwritten signature (Electronic Communications Act 2000 / UK eIDAS), and that the date,
                    time, network address and a fingerprint of this document will be recorded in a signature certificate.
                  </p>
                </div>
              </label>

              <div className="bg-white rounded-xl p-5 border border-purple-200">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Sign here to confirm you have read this contract to the last page and you are happy to proceed *
                </label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Type your full legal name"
                  className="w-full px-4 py-3 border-b-2 border-gray-400 focus:border-purple-600 focus:outline-none text-2xl text-gray-900 bg-transparent"
                  style={{ fontFamily: '"Segoe Script", "Brush Script MT", cursive' }}
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  Signed on behalf of <strong>{link.companyName}</strong> · {today}
                </p>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={!canSubmit || submitting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                canSubmit ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-xl hover:scale-[1.01]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}>
              {submitting ? 'Signing...' : 'Sign & Accept Engagement'}
            </button>

            {!canSubmit && !isExpired && (
              <p className="text-center text-sm text-gray-500">
                {!authorised && 'Please tick the declaration. '}
                {!esignConsent && 'Please agree to sign electronically. '}
                {signatureName.trim().length <= 1 && 'Type your full name in the signature box. '}
                {!ddValid && 'Complete your Direct Debit details (account name, number and 6-digit sort code). '}
                {!prevOk && 'Fill in your previous accountant details or confirm you have none.'}
              </p>
            )}
          </form>
        )}
        </>
        )}
      </div>
    </div>
  );
}
