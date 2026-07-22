'use client';
import { useState, Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, CheckCircle2, Building2, PenLine, Eye, X, FileText, UserSearch, Clock } from 'lucide-react';
import { getFirm } from '@/lib/firms';
import { LETTER_PARTNERS } from '@/lib/letter-html';
import { saveWizardDraft } from '@/lib/wizard-draft';

interface Director {
  name: string;
  email?: string;
}

interface CompanyData {
  number: string;
  name: string;
  address: string;
  status: string;
  directors: Director[];
  incorporationDate: string | null;
  aaDue: string | null;
  csDue: string | null;
  sicCodes: string[];
  natureOfBusiness: string | null;
  manual?: boolean;
}

function CompanyPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const firmSlug = searchParams.get('firm') || 'gns';
  const companyNumberParam = searchParams.get('companyNumber') || '';
  const directorEmailParam = searchParams.get('directorEmail') || '';
  const serviceDetailsParam = searchParams.get('serviceDetails') || '[]';
  const customFeesParam = searchParams.get('customFees') || '[]';
  const scopeRowsParam = searchParams.get('scopeRows') || '';
  const draftToken = searchParams.get('draft');

  const firm = getFirm(firmSlug);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [step, setStep] = useState<'input' | 'manual' | 'preview'>('input');
  const [companyNumber, setCompanyNumber] = useState(companyNumberParam);
  const [directorEmail, setDirectorEmail] = useState(directorEmailParam);
  const [selectedDirector, setSelectedDirector] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState<CompanyData | null>(null);

  // Letter options: acting partner, send mode, letter body, live preview
  const [partnerName, setPartnerName] = useState<string>(LETTER_PARTNERS[0]!);
  const [sendMode, setSendMode] = useState<'engagement' | 'proposal' | 'proposal_only' | 'details_only'>('engagement');
  const [regBody, setRegBody] = useState<'ACCA' | 'ICAEW'>(firm.regBody === 'ICAEW' ? 'ICAEW' : 'ACCA');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Optional scheduled send — local datetime string (empty = send immediately)
  const [scheduledSendAt, setScheduledSendAt] = useState<string>('');

  // Manual entry fields
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualDirector, setManualDirector] = useState('');

  // Live CH lookup + name search + duplicate detection
  const [nameQuery, setNameQuery] = useState('');
  const [nameResults, setNameResults] = useState<Array<{ companyNumber: string; name: string; status: string; address: string }>>([]);
  const [nameSearching, setNameSearching] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{ companyName: string; companyNumber: string; status: string; sentAt: string }>>([]);
  const [autoLookupDone, setAutoLookupDone] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-lookup CH when company number is 6+ chars
  useEffect(() => {
    if (company || autoLookupDone || companyNumber.trim().length < 6 || step !== 'input') return;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies-house/${companyNumber.trim()}`);
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await res.json() as any;
        const directors: Director[] = (data.officers || []).map(
          (o: string | { name: string; email?: string }) => (typeof o === 'string' ? { name: o } : o)
        );
        setCompany({
          number: data.number, name: data.name, address: data.address, status: data.status,
          directors, incorporationDate: data.incorporationDate ?? null,
          aaDue: data.aaDue ?? null, csDue: data.csDue ?? null,
          sicCodes: data.sicCodes ?? [], natureOfBusiness: data.natureOfBusiness ?? null,
        });
        if (directors.length > 0) setSelectedDirector(directors[0]?.name ?? '');
        setAutoLookupDone(true);
        setStep('preview');
      } catch {}
    }, 500);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyNumber]);

  // Duplicate detection when company number resolves
  useEffect(() => {
    if (!company?.number) { setDuplicates([]); return; }
    fetch(`/api/onboarding/links/check-duplicate?companyNumber=${encodeURIComponent(company.number)}&companyName=${encodeURIComponent(company.name)}`)
      .then((r) => r.json())
      .then((d) => setDuplicates(d.duplicates ?? []))
      .catch(() => {});
  }, [company?.number, company?.name]);

  // Name search typeahead
  useEffect(() => {
    if (nameQuery.trim().length < 2) { setNameResults([]); return; }
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(async () => {
      setNameSearching(true);
      try {
        const res = await fetch(`/api/companies-house/search?q=${encodeURIComponent(nameQuery.trim())}`);
        const data = await res.json();
        setNameResults(data.items ?? []);
      } catch { setNameResults([]); }
      setNameSearching(false);
    }, 400);
    return () => { if (nameTimer.current) clearTimeout(nameTimer.current); };
  }, [nameQuery]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (companyNumber.trim().length < 5) {
        throw new Error('Company number must be at least 5 characters');
      }

      const res = await fetch(`/api/companies-house/${companyNumber.trim()}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json().catch(() => ({})) as any;

      if (!res.ok) {
        setError(data.error || 'Could not look up company');
        return;
      }

      const directors: Director[] = (data.officers || []).map(
        (o: string | { name: string; email?: string }) => (typeof o === 'string' ? { name: o } : o)
      );

      setCompany({
        number: data.number,
        name: data.name,
        address: data.address,
        status: data.status,
        directors,
        incorporationDate: data.incorporationDate ?? null,
        aaDue: data.aaDue ?? null,
        csDue: data.csDue ?? null,
        sicCodes: data.sicCodes ?? [],
        natureOfBusiness: data.natureOfBusiness ?? null,
      });

      if (directors.length > 0) setSelectedDirector(directors[0]?.name ?? '');
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lookup company');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCompany({
      number: companyNumber.trim().toUpperCase(),
      name: manualName.trim(),
      address: manualAddress.trim(),
      status: 'active',
      directors: manualDirector.trim() ? [{ name: manualDirector.trim() }] : [],
      incorporationDate: null,
      aaDue: null,
      csDue: null,
      sicCodes: [],
      natureOfBusiness: null,
      manual: true,
    });
    setSelectedDirector(manualDirector.trim());
    setStep('preview');
  };

  const parseParams = () => {
    let serviceDetails: Array<{ id: string; name: string; price: number; oneoff?: boolean }> = [];
    let customFees: Array<{ description: string; price: number }> = [];
    let scopeRows: Array<{ service: string; threshold: string; excess: string }> | undefined;
    try { serviceDetails = JSON.parse(decodeURIComponent(serviceDetailsParam)); } catch {}
    try { customFees = JSON.parse(decodeURIComponent(customFeesParam)); } catch {}
    try { if (scopeRowsParam) scopeRows = JSON.parse(decodeURIComponent(scopeRowsParam)); } catch {}
    return { serviceDetails, customFees, scopeRows };
  };

  const buildPayload = () => {
    if (!company) return null;
    const { serviceDetails, customFees, scopeRows } = parseParams();
    const paymentMethodParam = searchParams.get('paymentMethod') || 'dd';
    const includeAnnexAParam = searchParams.get('includeAnnexA') !== '0';
    const clientTypeParam = searchParams.get('clientType') || 'limited';
    const clientNameParam = searchParams.get('clientName') || '';
    const businessAddressParam = searchParams.get('businessAddress') || '';
    const utrParam = searchParams.get('utr') || '';
    let oneoffScopesParam: Record<string, string> = {};
    try { oneoffScopesParam = JSON.parse(searchParams.get('oneoffScopes') || '{}'); } catch {}
    return {
      firmSlug,
      companyName: clientNameParam || company.name,
      companyNumber: company.number,
      companyAddress: businessAddressParam || company.address,
      directorName: selectedDirector || company.directors[0]?.name || '',
      directorEmail,
      serviceDetails,
      partnerName,
      sendMode,
      regBody,
      customFees,
      scopeRows,
      paymentMethod: paymentMethodParam,
      includeAnnexA: includeAnnexAParam,
      clientType: clientTypeParam,
      clientName: clientNameParam || company.name,
      businessAddress: businessAddressParam || company.address,
      utr: utrParam,
      oneoffScopes: oneoffScopesParam,
      ch: company.manual ? null : {
        number: company.number,
        status: company.status,
        address: company.address,
        incorporationDate: company.incorporationDate,
        aaDue: company.aaDue,
        csDue: company.csDue,
        natureOfBusiness: company.natureOfBusiness,
      },
    };
  };

  // Autosave the full Companies House snapshot (incl. directors + SIC codes)
  // and send options to the draft so the client record captures CH data and the
  // dashboard reflects progress at the Company step.
  useEffect(() => {
    if (!company) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { serviceDetails, customFees, scopeRows } = parseParams();
      const prices = Object.fromEntries(serviceDetails.map((s) => [s.id, s.price]));
      const selectedOneoff = serviceDetails.filter((s) => s.oneoff).map((s) => s.id);
      const token = await saveWizardDraft({
        token: draftToken,
        firmSlug,
        step: 'company',
        companyNumber: company.number || companyNumberParam,
        companyName: company.name,
        directorName: selectedDirector || company.directors[0]?.name || '',
        directorEmail,
        services: serviceDetails,
        prices,
        selectedOneoff,
        customFees,
        scopeRows: scopeRows ?? null,
        partnerName,
        sendMode,
        regBody,
        ch: {
          number: company.number,
          name: company.name,
          address: company.address,
          status: company.status,
          incorporationDate: company.incorporationDate,
          aaDue: company.aaDue,
          csDue: company.csDue,
          sicCodes: company.sicCodes,
          natureOfBusiness: company.natureOfBusiness,
          directors: company.directors,
          manual: !!company.manual,
        },
      });
      if (token) setSavedAt(new Date());
    }, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, selectedDirector, directorEmail, partnerName, sendMode, regBody]);

  const handlePreview = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setPreviewLoading(true);
    setError('');
    try {
      const res = await fetch('/api/onboarding/letter-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, services: payload.serviceDetails }),
      });
      if (!res.ok) throw new Error('Could not build letter preview');
      setPreviewHtml(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerate = async () => {
    const payload = buildPayload();
    if (!payload || !directorEmail) return;
    setLoading(true);
    setError('');

    try {
      // Convert the local datetime-local value to a full ISO timestamp.
      const scheduledIso = scheduledSendAt ? new Date(scheduledSendAt).toISOString() : undefined;
      const res = await fetch('/api/onboarding/links/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, draftToken, scheduledSendAt: scheduledIso }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error || 'Failed to generate engagement link');
      }
      const result = await res.json() as { token: string; scheduledSendAt?: string | null };

      const schedParam = result.scheduledSendAt ? `&scheduledAt=${encodeURIComponent(result.scheduledSendAt)}` : '';
      router.push(
        `/onboarding/success?firm=${firmSlug}&company=${encodeURIComponent(company!.name)}&email=${encodeURIComponent(directorEmail)}&token=${result.token}&mode=${sendMode}${schedParam}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-2 text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: firm.accentColor }}>Step 3 of 4</span>
              <span>— Company Verification</span>
            </div>
            {savedAt && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium" aria-live="polite">
                <CheckCircle2 size={13} aria-hidden="true" />
                Progress saved {savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full">
            <div className="h-full rounded-full transition-all" style={{ width: '75%', background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }} />
          </div>
        </div>

        {/* Firm badge */}
        <div className="flex items-center gap-3 mb-8 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Image src={firm.logo} alt={firm.name} width={40} height={40} className="object-contain" />
          <div>
            <p className="text-xs text-gray-500">Onboarding for</p>
            <p className="font-semibold text-gray-900">{firm.legalName}</p>
          </div>
        </div>

        {/* ── STEP: CH LOOKUP ── */}
        {step === 'input' && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Company</h1>
              <p className="text-gray-600">Enter the company number to look up details from Companies House.</p>
            </div>

            <form onSubmit={handleLookup} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Number *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="e.g., 08086819"
                    value={companyNumber}
                    onChange={(e) => setCompanyNumber(e.target.value.replace(/\s/g, '').toUpperCase())}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                    maxLength={10}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Found on the Companies House certificate or beta.companieshouse.gov.uk</p>
              </div>

              {/* Name search */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Or search by company name</label>
                <div className="relative">
                  <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Start typing company name..."
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {nameSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-purple-500" size={16} />}
                </div>
                {nameResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {nameResults.map((r) => (
                      <button key={r.companyNumber} type="button"
                        onClick={() => { setCompanyNumber(r.companyNumber); setNameQuery(''); setNameResults([]); setAutoLookupDone(false); setCompany(null); }}
                        className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b border-gray-100 last:border-0">
                        <p className="text-sm font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.companyNumber} · {r.status} · {r.address}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Duplicate warning */}
              {duplicates.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                  <p className="text-sm font-semibold text-amber-800">Existing client detected</p>
                  {duplicates.map((d, i) => (
                    <p key={i} className="text-xs text-amber-700 mt-1">
                      {d.companyName} ({d.companyNumber}) — Status: <strong>{d.status}</strong>
                      {d.sentAt && ` · Sent: ${new Date(d.sentAt).toLocaleDateString('en-GB')}`}
                    </p>
                  ))}
                  <p className="text-xs text-amber-600 mt-2">You can still proceed — this is just a warning.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Director Email Address *</label>
                <input
                  type="email"
                  placeholder="director@company.com"
                  value={directorEmail}
                  onChange={(e) => setDirectorEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">The engagement letter will be sent to this address</p>
              </div>

              {error && (
                <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep('manual'); }}
                    className="flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-900 underline underline-offset-2"
                  >
                    <PenLine size={14} />
                    Enter company details manually instead
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="flex items-center gap-2 px-6 py-3 text-gray-700 hover:text-gray-900 font-semibold"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !companyNumber || !directorEmail}
                  className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
                    loading || !companyNumber || !directorEmail
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'text-white hover:shadow-lg hover:scale-[1.02]'
                  }`}
                  style={loading || !companyNumber || !directorEmail ? {} : { background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }}
                >
                  {loading ? <><Loader2 size={20} className="animate-spin" /> Looking up...</> : <>Verify Company <ChevronRight size={20} /></>}
                </button>
              </div>

              <p className="text-center text-xs text-gray-400">
                Can&apos;t find the company?{' '}
                <button type="button" onClick={() => setStep('manual')} className="underline hover:text-gray-600">
                  Enter details manually
                </button>
              </p>
            </form>
          </>
        )}

        {/* ── STEP: MANUAL ENTRY ── */}
        {step === 'manual' && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Enter Company Details</h1>
              <p className="text-gray-600">Fill in the company details manually to continue.</p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Number *</label>
                <input
                  type="text"
                  value={companyNumber}
                  onChange={(e) => setCompanyNumber(e.target.value.replace(/\s/g, '').toUpperCase())}
                  placeholder="e.g., 04863765"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  maxLength={10}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Name *</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g., Acme Ltd"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Registered Address *</label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="e.g., 123 High Street, London, SW1A 1AA"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Director Full Name *</label>
                <input
                  type="text"
                  value={manualDirector}
                  onChange={(e) => setManualDirector(e.target.value)}
                  placeholder="e.g., John Smith"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Director Email Address *</label>
                <input
                  type="email"
                  value={directorEmail}
                  onChange={(e) => setDirectorEmail(e.target.value)}
                  placeholder="director@company.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => { setStep('input'); setError(''); }}
                  className="flex items-center gap-2 px-6 py-3 text-gray-700 hover:text-gray-900 font-semibold"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!manualName || !manualAddress || !manualDirector || !directorEmail || !companyNumber}
                  className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
                    !manualName || !manualAddress || !manualDirector || !directorEmail || !companyNumber
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'text-white hover:shadow-lg hover:scale-[1.02]'
                  }`}
                  style={!manualName || !manualAddress || !manualDirector || !directorEmail || !companyNumber ? {} : { background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }}
                >
                  Continue <ChevronRight size={20} />
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === 'preview' && company && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Confirm Details</h1>
              <p className="text-gray-600">Please verify these details before sending the engagement link.</p>
            </div>

            <div className="space-y-5">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start gap-3 mb-5">
                  <CheckCircle2 className={`flex-shrink-0 mt-0.5 ${company.manual ? 'text-blue-500' : 'text-green-500'}`} size={22} />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
                    <p className={`text-sm font-medium ${company.manual ? 'text-blue-700' : 'text-green-700'}`}>
                      {company.manual ? 'Entered manually' : 'Verified via Companies House'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Company Number</p>
                    <p className="font-semibold text-gray-900 font-mono mt-0.5">{company.number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Status</p>
                    <p className="font-semibold text-green-700 capitalize mt-0.5">{company.status}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Registered Address</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{company.address}</p>
                  </div>
                  {company.incorporationDate && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Incorporated</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{company.incorporationDate}</p>
                    </div>
                  )}
                  {company.natureOfBusiness && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Nature of Business (SIC)</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{company.natureOfBusiness}</p>
                    </div>
                  )}
                  {company.aaDue && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Accounts Due</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{company.aaDue}</p>
                    </div>
                  )}
                  {company.csDue && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Confirmation Statement Due</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{company.csDue}</p>
                    </div>
                  )}
                </div>

                {company.directors.length > 0 && (
                  <div className="mt-5 border-t border-gray-100 pt-5">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      {company.directors.length > 1 ? 'Select Primary Director' : 'Director'}
                    </p>
                    {company.directors.length > 1 ? (
                      <div className="space-y-2">
                        {company.directors.map((d, i) => (
                          <label
                            key={i}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedDirector === d.name ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="director"
                              value={d.name}
                              checked={selectedDirector === d.name}
                              onChange={(e) => setSelectedDirector(e.target.value)}
                              className="text-purple-600"
                            />
                            <span className="font-medium text-gray-900">{d.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="font-medium text-gray-900">{company.directors[0]?.name}</p>
                    )}
                  </div>
                )}
              </div>

              {/* What to send — the key decision before the link goes out */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <p className="text-sm font-bold text-gray-900 mb-3">What should we send to the client?</p>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${sendMode === 'engagement' ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="sendMode" checked={sendMode === 'engagement'} onChange={() => setSendMode('engagement')} className="mt-1 text-purple-600" />
                    <div>
                      <p className="font-semibold text-gray-900 flex items-center gap-2"><FileText size={16} className="text-purple-600" /> Engagement letter only</p>
                      <p className="text-xs text-gray-500 mt-1">Client reviews and e-signs the contract, provides Direct Debit and previous accountant details. Professional clearance fires automatically on signing.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${sendMode === 'proposal' ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="sendMode" checked={sendMode === 'proposal'} onChange={() => setSendMode('proposal')} className="mt-1 text-purple-600" />
                    <div>
                      <p className="font-semibold text-gray-900 flex items-center gap-2"><FileText size={16} className="text-purple-600" /> Proposal + Engagement letter</p>
                      <p className="text-xs text-gray-500 mt-1">Same signable contract, framed with a proposal covering note — best for a brand-new prospect who hasn&apos;t formally engaged yet.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${sendMode === 'proposal_only' ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="sendMode" checked={sendMode === 'proposal_only'} onChange={() => setSendMode('proposal_only')} className="mt-1 text-purple-600" />
                    <div>
                      <p className="font-semibold text-gray-900 flex items-center gap-2"><FileText size={16} className="text-purple-600" /> Proposal only (for approval)</p>
                      <p className="text-xs text-gray-500 mt-1">Send just the proposal/quote for the client to review and approve — no signing, Direct Debit or clearance yet. Send the engagement letter afterwards.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${sendMode === 'details_only' ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="sendMode" checked={sendMode === 'details_only'} onChange={() => setSendMode('details_only')} className="mt-1 text-purple-600" />
                    <div>
                      <p className="font-semibold text-gray-900 flex items-center gap-2"><UserSearch size={16} className="text-purple-600" /> Request previous accountant details only</p>
                      <p className="text-xs text-gray-500 mt-1">No contract yet — the client just provides their previous accountant&apos;s details so clearance can begin. Send the engagement letter later.</p>
                    </div>
                  </label>
                </div>

                {sendMode !== 'details_only' && (
                  <div className="mt-4 grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Acting partner (signs the letter)</label>
                      <select
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {LETTER_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Letter body (professional body)</label>
                      <select
                        value={regBody}
                        onChange={(e) => setRegBody(e.target.value as 'ACCA' | 'ICAEW')}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="ACCA">ACCA — Chartered Certified Accountants</option>
                        <option value="ICAEW">ICAEW — Chartered Accountants</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                <p className="text-sm text-purple-900 font-semibold mb-2">
                  {sendMode === 'details_only' ? 'Details request will be sent to:' : sendMode === 'proposal' ? 'Proposal & engagement letter will be sent to:' : sendMode === 'proposal_only' ? 'Proposal will be sent to:' : 'Engagement letter will be sent to:'}
                </p>
                <p className="font-bold text-gray-900 text-lg">{directorEmail}</p>
                <p className="text-xs text-purple-700 mt-2">
                  {sendMode === 'details_only'
                    ? 'The client will receive a 30-day link to a short form asking only for their previous accountant’s details.'
                    : `The client will receive a 30-day link to read and e-sign the ${regBody} engagement letter online. A copy is archived automatically when sent and again when signed.`}
                </p>

                <div className="mt-4 pt-4 border-t border-purple-200">
                  <label className="flex items-center gap-2 text-sm font-semibold text-purple-900 mb-1.5">
                    <Clock size={15} /> Schedule the email (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledSendAt}
                    min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
                    onChange={(e) => setScheduledSendAt(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2.5 border border-purple-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-purple-700 mt-1.5">
                    {scheduledSendAt
                      ? `The link is created now, but the email is held and sent on ${new Date(scheduledSendAt).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`
                      : 'Leave blank to send the email immediately. Set a date & time to schedule it.'}
                  </p>
                  {scheduledSendAt && (
                    <button type="button" onClick={() => setScheduledSendAt('')} className="text-xs text-purple-700 underline mt-1">
                      Clear — send immediately
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="text-red-500 flex-shrink-0" size={16} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
                <button
                  onClick={() => { setStep(company.manual ? 'manual' : 'input'); setCompany(null); setError(''); }}
                  className="flex items-center gap-2 px-6 py-3 text-gray-700 hover:text-gray-900 font-semibold"
                >
                  <ChevronLeft size={20} />
                  Edit Details
                </button>
                <div className="flex items-center gap-3">
                  {sendMode !== 'details_only' && (
                    <button
                      onClick={handlePreview}
                      disabled={previewLoading}
                      className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 hover:border-gray-500 transition-all"
                    >
                      {previewLoading ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
                      Preview Letter
                    </button>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
                      loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'text-white hover:shadow-xl hover:scale-[1.02]'
                    }`}
                    style={loading ? {} : { background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }}
                  >
                    {loading ? <><Loader2 size={20} className="animate-spin" /> Generating...</> : <>{scheduledSendAt ? 'Generate & Schedule' : 'Generate & Send Link'} <ChevronRight size={20} /></>}
                  </button>
                </div>
              </div>
            </div>

            {/* Letter preview modal — review & adjust before sending */}
            {previewHtml && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                      <p className="font-bold text-gray-900">Letter Preview — exactly as the client will see it</p>
                      <p className="text-xs text-gray-500">Signed by {partnerName} · To adjust fees or scope, go back to the Services step</p>
                    </div>
                    <button onClick={() => setPreviewHtml(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                      <X size={20} />
                    </button>
                  </div>
                  <iframe srcDoc={previewHtml} className="flex-1 w-full border-0" title="Letter preview" />
                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
                    <button onClick={() => setPreviewHtml(null)} className="px-5 py-2.5 rounded-lg font-semibold text-gray-600 hover:bg-gray-100">
                      Make Changes
                    </button>
                    <button
                      onClick={() => { setPreviewHtml(null); handleGenerate(); }}
                      disabled={loading}
                      className="px-6 py-2.5 rounded-lg font-semibold text-white"
                      style={{ background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }}
                    >
                      Looks Good — Send to Client
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={32} />
      </div>
    }>
      <CompanyPageInner />
    </Suspense>
  );
}
