'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, Clock, CheckCircle2, FileText, Lock, ChevronDown, ChevronUp, ChevronRight, Upload, ShieldCheck } from 'lucide-react';
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
  letterMeta?: { sendMode?: string; paymentMethod?: string } | null;
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
  // Direct Debit gate: after signing, the contract is only final once GoCardless
  // confirms the mandate is active (arrives via webhook), so the client waits here.
  const [ddPending, setDdPending] = useState(false);
  const [ddFailure, setDdFailure] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [letterHeight, setLetterHeight] = useState(1200);

  // OTP verification gate — a code is sent to the client's email
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Previous accountant fields
  const [prevFirmName, setPrevFirmName] = useState('');
  const [prevEmail, setPrevEmail] = useState('');
  const [prevPhone, setPrevPhone] = useState('');
  const [prevAddress, setPrevAddress] = useState('');
  const [noPrevAccountant, setNoPrevAccountant] = useState(false);

  // Director ID document statuses
  const [docStatus, setDocStatus] = useState<Record<string, string>>({});

  // Declaration + typed signature + e-sign consent
  const [authorised, setAuthorised] = useState(false);
  const [esignConsent, setEsignConsent] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  // Direct Debit is set up through GoCardless's own hosted page (Billing
  // Requests). We never touch the client's bank details — GoCardless collects
  // them and tells us only whether the mandate was created. The signature is
  // GATED on ddConfirmed being true (see canSubmit).
  const [ddConfirmed, setDdConfirmed] = useState(false);
  const [ddSetupLoading, setDdSetupLoading] = useState(false);
  const [ddSetupError, setDdSetupError] = useState('');
  const [ddChecking, setDdChecking] = useState(false);

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

  // While the Direct Debit mandate is being confirmed, poll until the webhook
  // has flipped the link to "accepted" (or recorded a mandate failure).
  useEffect(() => {
    if (!ddPending) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/onboarding/links/${token}/dd-status`);
        const data = await res.json() as {
          confirmed?: boolean; failureReason?: string | null; mandateStatus?: string | null;
          signedLetterUrl?: string | null; uploadUrl?: string;
        };
        if (data.confirmed) {
          setResult((prev) => ({ ...prev, signedLetterUrl: data.signedLetterUrl, uploadUrl: data.uploadUrl, mode: 'engagement' }));
          setDdPending(false);
          setSubmitted(true);
        } else if (data.mandateStatus && data.mandateStatus !== 'active' && data.mandateStatus !== 'pending_submission') {
          setDdFailure(data.failureReason || 'Your bank could not confirm the Direct Debit mandate.');
          setDdPending(false);
        }
      } catch { /* transient network error — keep polling */ }
    }, 4000);
    return () => clearInterval(poll);
  }, [ddPending, token]);

  // Persist the client's form entries across the GoCardless redirect. When they
  // click "Set up Direct Debit" the browser navigates away to GoCardless's
  // hosted page and back, which would otherwise wipe everything they've typed.
  const ddFormKey = `gns_engage_${token}`;
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(ddFormKey);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (typeof s.prevFirmName === 'string') setPrevFirmName(s.prevFirmName);
        if (typeof s.prevEmail === 'string') setPrevEmail(s.prevEmail);
        if (typeof s.prevPhone === 'string') setPrevPhone(s.prevPhone);
        if (typeof s.prevAddress === 'string') setPrevAddress(s.prevAddress);
        if (typeof s.noPrevAccountant === 'boolean') setNoPrevAccountant(s.noPrevAccountant);
        if (s.docStatus && typeof s.docStatus === 'object') setDocStatus(s.docStatus as Record<string, string>);
        if (s.contactPrefs && typeof s.contactPrefs === 'object') setContactPrefs(s.contactPrefs as Record<string, boolean>);
        if (typeof s.signatureName === 'string' && s.signatureName) setSignatureName(s.signatureName);
        if (typeof s.authorised === 'boolean') setAuthorised(s.authorised);
        if (typeof s.esignConsent === 'boolean') setEsignConsent(s.esignConsent);
      }
    } catch { /* ignore */ }
    // If we've just returned from GoCardless, verify the mandate was created.
    const qp = new URLSearchParams(window.location.search);
    if (qp.get('dd') === 'return') {
      setVerified(true); // already passed OTP before leaving; don't re-gate
      checkDdStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll GoCardless (via our server) for the billing-request result — used both
  // on return from the hosted flow and while we wait for confirmation.
  const checkDdStatus = async () => {
    setDdChecking(true);
    try {
      const res = await fetch(`/api/onboarding/links/${token}/dd-status`);
      const data = await res.json() as { ddConfirmed?: boolean };
      if (data.ddConfirmed) { setDdConfirmed(true); setDdSetupError(''); }
      return Boolean(data.ddConfirmed);
    } catch { return false; }
    finally { setDdChecking(false); }
  };

  // Keep checking for a short while after returning, since GoCardless can take
  // a moment to flip the billing request to "fulfilled".
  useEffect(() => {
    const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (!qp || qp.get('dd') !== 'return' || ddConfirmed) return;
    let n = 0;
    const iv = setInterval(async () => {
      n += 1;
      const ok = await checkDdStatus();
      if (ok || n >= 15) clearInterval(iv);
    }, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ddConfirmed]);

  const persistForm = () => {
    try {
      sessionStorage.setItem(ddFormKey, JSON.stringify({
        prevFirmName, prevEmail, prevPhone, prevAddress, noPrevAccountant,
        docStatus, contactPrefs, signatureName, authorised, esignConsent,
      }));
    } catch { /* ignore */ }
  };

  // Kick off GoCardless hosted Direct Debit setup: save the form, ask our
  // server to create the billing request + flow, then redirect to GoCardless.
  const startDirectDebit = async () => {
    setDdSetupLoading(true);
    setDdSetupError('');
    persistForm();
    try {
      const res = await fetch(`/api/onboarding/links/${token}/dd-start`, { method: 'POST' });
      const data = await res.json() as { authorisationUrl?: string; message?: string; error?: string };
      if (!res.ok || !data.authorisationUrl) throw new Error(data.message || data.error || 'Could not start Direct Debit setup.');
      window.location.href = data.authorisationUrl;
    } catch (err) {
      setDdSetupError(err instanceof Error ? err.message : 'Could not start Direct Debit setup.');
      setDdSetupLoading(false);
    }
  };

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
      <div className="max-w-xl w-full bg-white rounded-2xl p-6 sm:p-10 shadow-lg text-center">
        <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Not Found</h1>
        <p className="text-gray-600">This onboarding link is invalid or has expired. Please contact us.</p>
      </div>
    </div>
  );

  if (link.status === 'accepted') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-xl w-full bg-white rounded-2xl p-6 sm:p-10 shadow-lg text-center">
        <CheckCircle2 className="text-green-500 mx-auto mb-4" size={48} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Signed</h1>
        <p className="text-gray-600">
          This engagement letter for <strong>{link.companyName}</strong> has already been signed and completed.
          This link is no longer active. If you need a copy of the signed document, please contact {getFirm(link.firmSlug || 'gns').name}.
        </p>
      </div>
    </div>
  );

  // Signed, but the Direct Debit mandate is still awaiting bank confirmation —
  // reconnect them to the waiting screen rather than offering the form again.
  if (link.status === 'pending_dd' && !ddPending && !ddFailure && !submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-xl w-full bg-white rounded-2xl p-6 sm:p-10 shadow-lg text-center">
        <div className="inline-flex mb-6">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-gray-200 border-b-purple-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirming your Direct Debit…</h1>
        <p className="text-gray-600">
          You&apos;ve already signed for <strong>{link.companyName}</strong>. We&apos;re waiting for your bank to
          confirm the Direct Debit mandate — we&apos;ll email you the moment it&apos;s through. If you think
          something has gone wrong, contact {getFirm(link.firmSlug || 'gns').name}.
        </p>
      </div>
    </div>
  );

  const rawMode = link.letterMeta?.sendMode;
  const mode: 'details_only' | 'proposal_only' | 'engagement' =
    rawMode === 'details_only' ? 'details_only' : rawMode === 'proposal_only' ? 'proposal_only' : 'engagement';
  const isManualPayment = link.letterMeta?.paymentMethod === 'manual';
  const firmForGate = getFirm(link.firmSlug || 'gns');

  // ── OTP identity gate: send a verification code to the client's email ──
  const sendOtp = async () => {
    setOtpSending(true);
    setVerifyError('');
    try {
      const res = await fetch(`/api/onboarding/links/${token}/send-otp`, { method: 'POST' });
      const data = await res.json() as { sent?: boolean; email?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setOtpSent(true);
      setOtpMaskedEmail(data.email || '');
      setOtpCooldown(60);
      const timer = setInterval(() => setOtpCooldown((c) => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; }), 1000);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    try {
      const res = await fetch(`/api/onboarding/links/${token}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const data = await res.json() as { verified?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setVerified(true);
      setVerifyEmail(link.clientEmail || '');
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-5 sm:p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${firmForGate.accentColor}15` }}>
              <ShieldCheck size={26} style={{ color: firmForGate.accentColor }} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Verify it&apos;s you</h1>
            <p className="text-sm text-gray-500 mt-2">
              This document for <strong>{link.companyName}</strong> can only be opened by the person it was sent to.
              {otpSent
                ? <> Enter the 6-digit code sent to <strong>{otpMaskedEmail}</strong>.</>
                : ' Click below to receive a verification code by email.'}
            </p>
          </div>

          {!otpSent ? (
            <div className="space-y-4">
              <button
                onClick={sendOtp}
                disabled={otpSending}
                className="w-full py-3 rounded-xl font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${firmForGate.accentColor}, #1e3a8a)` }}
              >
                {otpSending ? 'Sending...' : 'Send Verification Code'}
              </button>
              {verifyError && <p className="text-sm text-red-600 text-center">{verifyError}</p>}
            </div>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                required
                className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center text-2xl font-mono tracking-widest"
              />
              {verifyError && <p className="text-sm text-red-600 text-center">{verifyError}</p>}
              <button
                type="submit"
                disabled={otpCode.length !== 6}
                className={`w-full py-3 rounded-xl font-bold text-white ${otpCode.length === 6 ? '' : 'opacity-50 cursor-not-allowed'}`}
                style={{ background: `linear-gradient(135deg, ${firmForGate.accentColor}, #1e3a8a)` }}
              >
                Verify &amp; Continue
              </button>
              <button
                type="button"
                onClick={sendOtp}
                disabled={otpCooldown > 0 || otpSending}
                className="w-full text-sm text-purple-600 hover:text-purple-800 font-medium disabled:text-gray-400"
              >
                {otpCooldown > 0 ? `Resend code (${otpCooldown}s)` : 'Resend code'}
              </button>
            </form>
          )}

          <p className="text-xs text-gray-400 text-center mt-5">
            Your verification is recorded in the e-Sign Audit Trail.
          </p>
        </div>
      </div>
    );
  }

  const expiresAt = new Date(link.expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft <= 0;
  const isExpiringSoon = daysLeft > 0 && daysLeft <= 7;
  const firm = getFirm(link.firmSlug || 'gns');
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Direct Debit is valid only once GoCardless has confirmed the mandate
  // (ddConfirmed) — this is the hard gate the client cannot sign without.
  const ddValid = isManualPayment || ddConfirmed;

  const prevOk = noPrevAccountant || (prevFirmName && prevEmail && prevPhone && prevAddress.trim());

  const canSubmit = mode === 'details_only'
    ? Boolean(authorised && esignConsent && signatureName.trim().length > 1 && prevOk) && !isExpired
    : mode === 'proposal_only'
    ? Boolean(authorised && esignConsent && signatureName.trim().length > 1) && !isExpired
    : Boolean(authorised && esignConsent && signatureName.trim().length > 1 && prevOk && ddValid) && !isExpired;

  // Keep the Sign button visible/clickable at all times (see below) — when
  // clicked with something missing, scroll the client to the first thing
  // that needs their attention and focus it, rather than leaving them
  // guessing why a greyed-out button won't respond.
  const focusFirstError = () => {
    const checks: Array<{ ok: boolean; selector: string }> = [];
    if (mode !== 'proposal_only') checks.push({ ok: Boolean(prevOk), selector: '[data-field="prevAccountant"]' });
    if (mode === 'engagement' && !isManualPayment) checks.push({ ok: ddValid, selector: '[data-field="directDebit"]' });
    checks.push({ ok: authorised, selector: '[data-field="authorised"]' });
    checks.push({ ok: esignConsent, selector: '[data-field="esignConsent"]' });
    checks.push({ ok: signatureName.trim().length > 1, selector: '[data-field="signatureName"]' });
    const firstBad = checks.find((c) => !c.ok);
    if (!firstBad) return;
    const el = document.querySelector(firstBad.selector) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable = (el.matches('input,textarea,select') ? el : el.querySelector('input,textarea,select')) as HTMLElement | null;
    focusable?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) { focusFirstError(); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/onboarding/links/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prevFirmName: (noPrevAccountant || mode === 'proposal_only') ? null : prevFirmName,
          prevEmail: (noPrevAccountant || mode === 'proposal_only') ? null : prevEmail,
          prevPhone: (noPrevAccountant || mode === 'proposal_only') ? null : prevPhone,
          prevAddress: (noPrevAccountant || mode === 'proposal_only') ? null : prevAddress.trim(),
          noPrevAccountant: mode === 'proposal_only' ? true : noPrevAccountant,
          directorDocs: mode === 'proposal_only' ? [] : DIRECTOR_DOCS.map((d) => ({ id: d.id, label: d.label, status: docStatus[d.id] || 'later' })),
          signatureName: signatureName.trim(),
          confirmEmail: verifyEmail.trim(),
          contactPrefs: CONTACT_PREFS.filter((p) => contactPrefs[p.id]).map((p) => p.id),
          // No bank details cross our servers — GoCardless holds them. We only
          // signal that the mandate was confirmed via the hosted flow.
          directDebitConfirmed: (mode === 'engagement' && !isManualPayment) ? ddConfirmed : null,
          authorised,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Submission failed');
      setResult(data as { signedLetterUrl?: string | null; uploadUrl?: string; mode?: string });
      try { sessionStorage.removeItem(ddFormKey); } catch { /* ignore */ }
      // Direct Debit gate: contract isn't final until the bank confirms the
      // mandate, so hold the client on the waiting screen and poll for it.
      if ((data as { pending?: boolean }).pending) {
        setDdPending(true);
      } else {
        setSubmitted(true);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Waiting on the bank to confirm the Direct Debit mandate ──────────────
  if (ddPending || ddFailure) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-10">
        <div className="max-w-xl w-full bg-white rounded-2xl p-6 sm:p-10 shadow-lg text-center">
          {ddFailure ? (
            <>
              <AlertCircle className="text-red-500 mx-auto mb-4" size={56} />
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Direct Debit not confirmed</h1>
              <p className="text-gray-600 mb-6">{ddFailure}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-left mb-6">
                <p className="text-sm text-amber-900">
                  Your signature has been recorded, but your engagement with {firm.legalName} cannot be
                  completed until a valid Direct Debit mandate is in place. Please contact us on{' '}
                  <strong>{firm.phone}</strong> or <strong>{firm.email}</strong> and we&apos;ll set this up with you.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex mb-6">
                <div className="animate-spin rounded-full h-14 w-14 border-4 border-gray-200 border-b-purple-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Confirming your Direct Debit…</h1>
              <p className="text-gray-600 mb-6">
                Thank you, <strong>{signatureName || link.directorName}</strong>. We&apos;ve submitted your
                Direct Debit mandate to your bank and are waiting for confirmation. This usually takes a few
                seconds — please keep this page open.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-left">
                <p className="text-sm text-blue-900">
                  Your engagement with {firm.legalName} is completed automatically the moment the mandate is
                  confirmed. If this page is still waiting after a few minutes, you can safely close it — we&apos;ll
                  email you as soon as it&apos;s through.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (submitted) {
    const anyReady = DIRECTOR_DOCS.some((d) => (docStatus[d.id] || 'later') === 'ready');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-10">
        <div className="max-w-xl w-full bg-white rounded-2xl p-6 sm:p-10 shadow-lg text-center">
          <div className="inline-flex mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-40" />
              <CheckCircle2 className="text-green-500 relative" size={72} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {mode === 'details_only' ? 'Details Received!' : mode === 'proposal_only' ? 'Proposal Approved!' : 'Contract Signed!'}
          </h1>
          <p className="text-gray-600 mb-6">
            Thank you, <strong>{signatureName || link.directorName}</strong>.
            {mode === 'details_only'
              ? ' We will contact your previous accountant to arrange the professional handover.'
              : mode === 'proposal_only'
              ? ` Your proposal with ${firm.legalName} has been approved. We'll send your engagement letter shortly to formalise the appointment.`
              : ` Your contract with ${firm.legalName} has been signed and confirmed.`}
          </p>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-left space-y-2 mb-6">
            <p className="text-sm text-gray-700">✅ Confirmation sent to <strong>{link.clientEmail}</strong></p>
            {!noPrevAccountant && prevEmail && (
              <p className="text-sm text-gray-700">✅ Professional clearance request sent to <strong>{prevEmail}</strong></p>
            )}
            <p className="text-sm text-gray-700">✅ {firm.name} has been notified</p>
          </div>

          {/* The client's own copy of the executed contract. Always offered in
              engagement mode — the URL is derivable from the token, so it must
              not depend on the accept response carrying it back. */}
          {mode === 'engagement' && (
            <a
              href={result?.signedLetterUrl || `/api/onboarding/links/${token}/letter?signed=1&pdf=1`}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-white mb-3"
              style={{ background: `linear-gradient(135deg, ${firm.accentColor}, #1e3a8a)` }}
            >
              <FileText size={18} /> Download your signed engagement letter (PDF)
            </a>
          )}

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
            <div data-field="prevAccountant" className="bg-white rounded-2xl p-5 sm:p-8 border border-gray-200 shadow-sm">
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
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Their Postal Address *</label>
                    <textarea value={prevAddress} onChange={(e) => setPrevAddress(e.target.value)} required rows={3}
                      placeholder={'Building & Street\nTown / City\nPostcode'}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                </div>
              )}
            </div>

            {/* Declaration + e-signature — authority to approach the previous accountant */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-2xl p-5 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="text-purple-600" size={22} />
                <h2 className="text-lg font-bold text-gray-900">Declaration &amp; Electronic Signature</h2>
              </div>

              <div className="bg-white rounded-xl p-5 mb-5 border border-purple-200">
                <p className="text-gray-800 leading-relaxed text-sm">
                  I, <strong>{signatureName || link.directorName || 'the undersigned'}</strong>, being a Director of{' '}
                  <strong>{link.companyName}</strong> (Company No. {link.companyNumber}), hereby authorise{' '}
                  <strong>{firm.legalName}</strong> to contact my previous accountant to request professional clearance
                  and the handover of my company&apos;s books, records and tax information on my behalf.
                </p>
              </div>

              <label data-field="authorised" className="flex items-start gap-3 cursor-pointer mb-3">
                <input type="checkbox" checked={authorised} onChange={(e) => setAuthorised(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-400 text-purple-600 mt-0.5" />
                <p className="font-bold text-gray-900">
                  I authorise {firm.name} to contact my previous accountant on my behalf
                </p>
              </label>

              <label data-field="esignConsent" className="flex items-start gap-3 cursor-pointer mb-5">
                <input type="checkbox" checked={esignConsent} onChange={(e) => setEsignConsent(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-400 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-purple-600" /> I agree to sign this authorisation electronically
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    I understand that typing my name below constitutes my legal electronic signature, with the same legal
                    effect as a handwritten signature (Electronic Communications Act 2000 / UK eIDAS), and that the date,
                    time and network address will be recorded.
                  </p>
                </div>
              </label>

              <div className="bg-white rounded-xl p-5 border border-purple-200">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Sign here to confirm *</label>
                <input
                  data-field="signatureName"
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

            {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl"><p className="text-sm text-red-700">{error}</p></div>}

            {/* Always visible/clickable — validation errors scroll the client
                to the first thing missing rather than hiding the button. */}
            <button type="submit" disabled={submitting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${canSubmit ? 'text-white hover:shadow-xl' : 'bg-gray-300 text-gray-600 hover:bg-gray-400'}`}
              style={canSubmit ? { background: `linear-gradient(135deg, ${firm.accentColor}, #1e3a8a)` } : {}}>
              {submitting ? 'Submitting...' : 'Sign & Submit Details'}
            </button>

            {!canSubmit && !isExpired && (
              <p className="text-center text-sm text-gray-500">
                {!authorised && 'Please tick the authorisation. '}
                {!esignConsent && 'Please agree to sign electronically. '}
                {signatureName.trim().length <= 1 && 'Type your full name in the signature box. '}
                {!prevOk && 'Fill in your previous accountant details or confirm you have none.'}
              </p>
            )}
          </form>
        ) : (
        <>
        {/* Orientation banner. Clients paying by Direct Debit must complete the
            mandate BEFORE the signature unlocks, so say so up front in two
            sentences rather than letting them discover it at the bottom. */}
        {mode === 'engagement' && !isManualPayment && !ddConfirmed && (
          <div className="p-5 rounded-xl border-2 border-amber-300 bg-amber-50">
            <p className="font-bold text-amber-900 mb-1">How to complete this in three steps</p>
            <p className="text-sm text-amber-900">
              Read the engagement letter below, fill in the short form, then set up your Direct Debit.
              <strong> The Direct Debit must be confirmed before the signature box will unlock</strong> — it takes about two minutes and you&apos;ll be brought straight back here.
            </p>
          </div>
        )}
        {mode === 'engagement' && !isManualPayment && ddConfirmed && (
          <div className="p-5 rounded-xl border-2 border-green-300 bg-green-50">
            <p className="font-bold text-green-900 mb-1">Direct Debit confirmed — you can sign</p>
            <p className="text-sm text-green-900">
              Your mandate is in place. Read the engagement letter below, complete the remaining details, then sign at the bottom of the page.
            </p>
          </div>
        )}

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

            {mode === 'proposal_only' && (
              <div className="bg-white rounded-2xl p-5 sm:p-8 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Approve this proposal</h2>
                <p className="text-sm text-gray-500">
                  Please review the proposal above. If you are happy to proceed, approve it below and we&apos;ll send your
                  engagement letter to formalise the appointment. No payment details or signature of the contract are
                  needed at this stage.
                </p>
              </div>
            )}

            {mode !== 'proposal_only' && (<>
            {/* Previous Accountant */}
            <div data-field="prevAccountant" className="bg-white rounded-2xl p-5 sm:p-8 border border-gray-200">
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
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Their Postal Address *</label>
                    <textarea value={prevAddress} onChange={(e) => setPrevAddress(e.target.value)} required={!noPrevAccountant} rows={3}
                      placeholder={'Building & Street\nTown / City\nPostcode'}
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

            {/* Direct Debit — set up securely on GoCardless's hosted page.
                We never see or store bank details; the signature is gated on
                GoCardless confirming the mandate (ddConfirmed). */}
            {!isManualPayment && (
            <div data-field="directDebit" className={`bg-white rounded-2xl p-5 sm:p-8 border-2 ${ddConfirmed ? 'border-green-400' : 'border-gray-300'}`}>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Direct Debit Setup (GoCardless) *</h2>
              <p className="text-sm text-gray-500 mb-5">
                Required to complete the contract. Your fees are collected by Direct Debit, protected by the Direct Debit
                Guarantee. You&apos;ll set this up securely on GoCardless — <strong>{firm.name} never sees your bank details</strong>.
              </p>

              {ddConfirmed ? (
                <div className="flex items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-5 py-4">
                  <CheckCircle2 size={26} className="text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-green-800">Direct Debit set up ✓</p>
                    <p className="text-sm text-green-700">Your mandate is confirmed with GoCardless. You can now sign below.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Plain, step-by-step instructions. The DD mandate is a hard
                      gate on signing, so the client must understand exactly what
                      to do and that they will be brought back here. */}
                  <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-900 mb-2">
                      This must be completed before you can sign.
                    </p>
                    <ol className="text-sm text-amber-900 space-y-1 list-decimal list-inside">
                      <li>Click <strong>Set up Direct Debit</strong> below — it opens GoCardless&apos;s secure page.</li>
                      <li>Enter your bank details there and confirm the mandate.</li>
                      <li>
                        GoCardless brings you <strong>straight back to this page</strong> automatically and this box turns
                        green — the signature section below then unlocks.
                      </li>
                    </ol>
                    <p className="text-xs text-amber-800 mt-2">
                      Anything you have already filled in on this form is saved while you&apos;re away.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startDirectDebit}
                    disabled={ddSetupLoading || ddChecking}
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-bold text-white text-base shadow-lg hover:shadow-xl transition-shadow disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, ${firm.accentColor}, #1e3a8a)` }}
                  >
                    {ddSetupLoading
                      ? 'Opening secure GoCardless page…'
                      : ddChecking
                      ? 'Checking your Direct Debit…'
                      : 'Set up Direct Debit — takes about 2 minutes'}
                  </button>
                  {ddChecking && !ddSetupLoading && (
                    <p className="mt-3 text-sm text-gray-500 flex items-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                      Waiting for GoCardless to confirm your mandate…
                    </p>
                  )}
                  {ddSetupError && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                      <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700">{ddSetupError}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={checkDdStatus}
                    className="mt-3 text-sm text-purple-700 hover:text-purple-900 font-medium"
                  >
                    Already set it up? Check status
                  </button>
                </>
              )}

              <details className="mt-4 group">
                <summary className="text-xs font-semibold text-purple-700 cursor-pointer select-none list-none flex items-center gap-1">
                  <ChevronRight size={13} className="group-open:rotate-90 transition-transform" />
                  Direct Debit Guarantee
                </summary>
                <div className="text-xs text-gray-600 mt-2 leading-relaxed space-y-2 pl-4">
                  <p>
                    <strong>The Direct Debit Guarantee</strong> — This Guarantee is offered by all banks and building societies
                    that accept instructions to pay Direct Debits. If there are any changes to the amount, date or frequency of
                    your Direct Debit, {firm.name} will notify you in advance. If an error is made in the payment of your Direct
                    Debit, you are entitled to a full and immediate refund from your bank or building society. You can cancel a
                    Direct Debit at any time by contacting your bank or building society.
                  </p>
                </div>
              </details>
            </div>
            )}

            {/* Contact preferences */}
            <div className="bg-white rounded-2xl p-5 sm:p-8 border border-gray-200">
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
            </>)}

            {/* Declaration + E-Signature */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-2xl p-5 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="text-purple-600" size={22} />
                <h2 className="text-lg font-bold text-gray-900">{mode === 'proposal_only' ? 'Proposal Approval' : 'Client Declaration & Electronic Signature'}</h2>
              </div>

              <div className="bg-white rounded-xl p-5 mb-5 border border-purple-200">
                <p className="text-gray-800 leading-relaxed text-sm">
                  {mode === 'proposal_only' ? (
                    <>I, <strong>{signatureName || link.directorName || 'the undersigned'}</strong>, being a Director of{' '}
                    <strong>{link.companyName}</strong> (Company No. {link.companyNumber}), confirm that I have reviewed this
                    proposal and I am happy to proceed. I understand this is an approval of the proposal and that a formal
                    engagement letter will follow for signature.</>
                  ) : (
                    <>I, <strong>{signatureName || link.directorName || 'the undersigned'}</strong>, being a Director of{' '}
                    <strong>{link.companyName}</strong> (Company No. {link.companyNumber}), confirm that I have read this
                    contract to the last page and I am happy to proceed. I hereby authorise <strong>{firm.legalName}</strong> to
                    act as the company&apos;s accountants and to take over all accountancy work with effect from the date of this
                    agreement, and I agree to the terms of this letter, the schedule(s) of services, the privacy notice and the
                    standard terms and conditions.</>
                  )}
                </p>
              </div>

              <label data-field="authorised" className="flex items-start gap-3 cursor-pointer mb-3">
                <input type="checkbox" checked={authorised} onChange={(e) => setAuthorised(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-400 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900">
                    {mode === 'proposal_only'
                      ? `I have reviewed this proposal and wish to proceed with ${firm.name}`
                      : `I have read and understood the contract in its entirety and authorise ${firm.name} to take over all my accountancy work`}
                  </p>
                </div>
              </label>

              <label data-field="esignConsent" className="flex items-start gap-3 cursor-pointer mb-5">
                <input type="checkbox" checked={esignConsent} onChange={(e) => setEsignConsent(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-400 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-purple-600" /> I agree to sign this contract electronically
                  </p>
                  <details className="group mt-1">
                    <summary className="text-xs font-semibold text-purple-700 cursor-pointer select-none list-none flex items-center gap-1">
                      <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                      What this means (legal note)
                    </summary>
                    <p className="text-sm text-gray-600 mt-1 pl-4">
                      I understand that typing my name below constitutes my legal electronic signature, with the same legal
                      effect as a handwritten signature (Electronic Communications Act 2000 / UK eIDAS), and that the date,
                      time, network address and a fingerprint of this document will be recorded in a signature certificate.
                    </p>
                  </details>
                </div>
              </label>

              <div className="bg-white rounded-xl p-5 border border-purple-200">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Sign here to confirm you have read this contract to the last page and you are happy to proceed *
                </label>
                <input
                  data-field="signatureName"
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

            {/* Always visible/clickable — validation errors scroll the client
                to the first thing missing rather than hiding the button. */}
            <button type="submit" disabled={submitting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                canSubmit ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-xl hover:scale-[1.01]' : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
              }`}>
              {submitting ? (mode === 'proposal_only' ? 'Approving...' : 'Signing...') : (mode === 'proposal_only' ? 'Approve Proposal' : 'Sign & Accept Engagement')}
            </button>

            {!canSubmit && !isExpired && (
              <p className="text-center text-sm text-gray-500">
                {!authorised && 'Please tick the declaration. '}
                {!esignConsent && 'Please agree to sign electronically. '}
                {signatureName.trim().length <= 1 && 'Type your full name in the signature box. '}
                {!isManualPayment && !ddValid && 'Set up your Direct Debit with GoCardless above — this must be confirmed before you can sign. '}
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
