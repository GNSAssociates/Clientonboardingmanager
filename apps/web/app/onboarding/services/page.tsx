'use client';
import { useState, Suspense, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, ChevronDown, ChevronUp, Plus, Trash2, Check, Search, AlertTriangle, Building2, CheckCircle2 } from 'lucide-react';
import { DEFAULT_SCOPE_ROWS, type ScopeRow } from '@/lib/letter-html';
import { saveWizardDraft, loadWizardDraft } from '@/lib/wizard-draft';

type Frequency = 'monthly' | 'quarterly' | 'annually';
type PaymentMethod = 'dd' | 'manual';
interface SoftwareItem { name: string; price: number }
interface CustomFee { title: string; description: string; price: number; frequency: 'one-off' | Frequency }

// Client types that do NOT require a Companies House number
const NON_CH_TYPES = new Set(['btl', 'sole_trader', 'individual', 'partnership']);

// Which client types can see each service
const SERVICE_VISIBILITY: Record<string, Set<string>> = {
  annual_accounts: new Set(['limited', 'llp']),
  confirmation_statement: new Set(['limited', 'llp']),
  registered_office: new Set(['limited', 'llp']),
  bookkeeping_vat: new Set(['limited', 'llp', 'sole_trader', 'partnership']),
  paye: new Set(['limited', 'llp', 'sole_trader', 'partnership']),
  cis: new Set(['limited', 'llp', 'sole_trader', 'partnership']),
  self_assessment: new Set(['limited', 'llp', 'sole_trader', 'btl', 'individual', 'partnership']),
  software_subscription: new Set(['limited', 'llp', 'sole_trader', 'btl', 'individual', 'partnership']),
};

// Labels that change per client type
const CLIENT_TYPE_LABELS: Record<string, { contactLabel: string; emailHint: string }> = {
  limited: { contactLabel: 'Primary Director Email *', emailHint: 'The engagement letter will be sent to this email address' },
  llp: { contactLabel: 'Designated Member Email *', emailHint: 'The engagement letter will be sent to this email address' },
  sole_trader: { contactLabel: 'Proprietor Email *', emailHint: 'The engagement letter will be sent to this email address' },
  btl: { contactLabel: 'Client Email *', emailHint: 'The engagement letter will be sent to this email address' },
  partnership: { contactLabel: 'Primary Partner Email *', emailHint: 'The engagement letter will be sent to this email address' },
  individual: { contactLabel: 'Client Email *', emailHint: 'The engagement letter will be sent to this email address' },
};

interface CHCompany {
  name: string;
  number: string;
  status: string;
  address: string;
  officers: { name: string }[];
  incorporationDate?: string | null;
  aaDue?: string | null;
  csDue?: string | null;
}

interface DuplicateResult {
  token: string;
  companyName: string;
  companyNumber: string;
  status: string;
  sentAt: string;
}

const SERVICES = [
  {
    id: 'annual_accounts',
    name: 'Annual Accounts & Corporation Tax',
    basePrice: 150,
    description: 'Statutory accounts, CT600 and Companies House filings',
    threshold: 'Turnover ≤ £200,000/year',
    excess: 'To be agreed later',
  },
  {
    id: 'bookkeeping_vat',
    name: 'Bookkeeping & Quarterly VAT Returns',
    basePrice: 200,
    description: 'Monthly bookkeeping and MTD-compliant VAT return filing',
    threshold: '300 transactions/quarter (bank lines + invoices)',
    excess: '£0.95 + VAT per extra transaction',
  },
  {
    id: 'paye',
    name: 'PAYE & Pension',
    basePrice: 75,
    description: 'Payroll processing, RTI filings and auto-enrolment',
    threshold: '2 persons including directors',
    excess: 'Setup: £10+VAT · Ongoing: £10+VAT per staff per pay run',
  },
  {
    id: 'cis',
    name: 'CIS Compliance',
    basePrice: 80,
    description: 'Construction Industry Scheme monthly returns',
    threshold: 'N/A',
    excess: '£10+VAT per subcontractor per month',
  },
  {
    id: 'self_assessment',
    name: 'Self-Assessment (excl. Buy-to-Let)',
    basePrice: 50,
    description: "Director's personal tax return filing",
    threshold: '2 persons including directors',
    excess: '£200+VAT per year per additional person',
  },
  {
    id: 'confirmation_statement',
    name: 'Confirmation Statement',
    basePrice: 15,
    description: 'Annual filing to Companies House',
    threshold: 'Once a year',
    excess: '£50+VAT for additional filing',
  },
  // Subscription based services (Annex A — SSC)
  {
    id: 'registered_office',
    name: 'Registered Office Address',
    basePrice: 20,
    description: 'Use our address as your company registered office',
    threshold: 'Subscription — £20+VAT monthly',
    excess: '—',
  },
  {
    id: 'software_subscription',
    name: 'Software Subscription',
    basePrice: 25,
    description: 'Accounting software (QuickBooks, Xero, Dext, etc.)',
    threshold: 'Subscription — £25+VAT monthly',
    excess: '—',
  },
];

// One-off / ad-hoc services (Annex A — Schedule of Service Charges).
// Prices are the total client-facing fee (inc. VAT where applicable).
const ONEOFF_GROUPS: { group: string; items: { id: string; name: string; basePrice: number; note?: string }[] }[] = [
  {
    group: 'Self-Assessment Tax Return',
    items: [
      { id: 'sa_btl', name: 'Buy to Let SA Filing', basePrice: 250, note: 'Single (£350 couple) + VAT' },
      { id: 'sa_director', name: 'Director / other SA (Salary, Dividend)', basePrice: 200, note: 'Single (£375 couple) + VAT' },
      { id: 'sa_sole_trader', name: 'Sole Trader (GNS bookkeeping)', basePrice: 350, note: '+ VAT' },
      { id: 'sa_boc', name: 'Change of Beneficial Ownership (Rental)', basePrice: 500, note: 'New £500 / Existing £400 + VAT' },
      { id: 'sa_mtd_quarterly', name: 'MTD SA — Quarterly', basePrice: 75, note: 'Single (£150 couple) + VAT per quarter' },
    ],
  },
  {
    group: 'Compliance & Tax Registration',
    items: [
      { id: 'reg_company', name: 'Company Registration', basePrice: 250, note: 'inc. CH fee & VAT' },
      { id: 'reg_company_sameday', name: 'Company Registration — Same Day', basePrice: 396, note: 'inc. CH fee & VAT' },
      { id: 'reg_change_name', name: 'Change of Name', basePrice: 110, note: 'inc. CH fee & VAT' },
      { id: 'reg_change_name_sameday', name: 'Same Day Change of Name', basePrice: 265, note: 'inc. CH fee & VAT' },
      { id: 'reg_conf_stmt', name: 'Confirmation Statement Filing', basePrice: 110, note: 'inc. CH fee & VAT' },
      { id: 'reg_strike_off', name: 'Voluntary Strike Off (DS01)', basePrice: 134, note: 'inc. CH fee & VAT' },
      { id: 'reg_charge', name: 'Charge Registration', basePrice: 75, note: 'inc. CH fee & VAT' },
      { id: 'reg_good_standing', name: 'Certificate of Good Standing', basePrice: 75, note: 'inc. CH fee & VAT' },
      { id: 'reg_good_standing_express', name: 'Certificate of Good Standing — Express', basePrice: 140, note: 'inc. CH fee & VAT' },
      { id: 'reg_shareholding', name: 'Shareholding Changes', basePrice: 60, note: 'inc. VAT' },
      { id: 'reg_director', name: 'Director Appointment / Termination', basePrice: 60, note: 'inc. VAT' },
      { id: 'reg_address', name: 'Company / Director Address Changes', basePrice: 60, note: 'inc. VAT' },
      { id: 'reg_id_verification', name: 'Companies House Identity Verification', basePrice: 90, note: 'inc. VAT' },
      { id: 'reg_reference', name: 'Reference Letters and Forms', basePrice: 120, note: 'inc. VAT' },
      { id: 'reg_paye', name: 'PAYE Registration', basePrice: 120, note: 'inc. VAT' },
      { id: 'reg_vat', name: 'VAT Registration', basePrice: 90, note: 'inc. VAT' },
      { id: 'reg_sa', name: 'Self-Assessment Registration', basePrice: 120, note: 'inc. VAT' },
    ],
  },
];

const ALL_ONEOFF = ONEOFF_GROUPS.flatMap((g) => g.items);

// Which contract Scope-of-Services row each monthly service edits (index into DEFAULT_SCOPE_ROWS)
const SCOPE_MAP: Record<string, number> = {
  annual_accounts: 0,
  bookkeeping_vat: 1,
  paye: 2,
  cis: 3,
  self_assessment: 4,
  confirmation_statement: 5,
};

function ServicesPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [firmSlug, setFirmSlug] = useState(searchParams.get('firm') || 'gns');
  const firm = firmSlug;

  // Draft autosave/resume: token lives in the URL (?draft=) so a refresh or a
  // dashboard "Resume" click restores exactly where the staff member left off.
  const [draftToken, setDraftToken] = useState<string | null>(searchParams.get('draft'));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [selectedOneoff, setSelectedOneoff] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries([...SERVICES, ...ALL_ONEOFF].map((s) => [s.id, s.basePrice]))
  );
  const [companyNumber, setCompanyNumber] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [oneoffExpanded, setOneoffExpanded] = useState(false);

  // Custom catch-up / ad-hoc fee lines (renamable boxes with title, description, price, frequency)
  const [customFees, setCustomFees] = useState<CustomFee[]>([]);

  // Billing frequency per service
  const [frequencies, setFrequencies] = useState<Record<string, Frequency>>({});

  // Payment method toggle
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dd');

  // Include in engagement letter per service
  const [includeInLetter, setIncludeInLetter] = useState<Record<string, boolean>>({});

  // Include Annex A schedule of charges
  const [includeAnnexA, setIncludeAnnexA] = useState(true);

  // Software subscription items
  const [softwareItems, setSoftwareItems] = useState<SoftwareItem[]>([{ name: 'QuickBooks', price: 25 }]);

  // Scope descriptions for one-off services
  const [oneoffScopes, setOneoffScopes] = useState<Record<string, string>>({});

  // Unique Taxpayer Reference (self-assessment / non-company clients)
  const [utr, setUtr] = useState('');

  // Client type
  const [clientType, setClientType] = useState('limited');

  // Contract Scope-of-Services rows — edited inline within each service card
  const [scopeRows, setScopeRows] = useState<ScopeRow[]>(DEFAULT_SCOPE_ROWS.map((r) => ({ ...r })));

  // Client / business name (for all types — auto-filled from CH for companies)
  const [clientName, setClientName] = useState('');
  // Registered business address (for all types — auto-filled from CH for companies)
  const [businessAddress, setBusinessAddress] = useState('');

  // Companies House live lookup state
  const [chLoading, setChLoading] = useState(false);
  const [chCompany, setChCompany] = useState<CHCompany | null>(null);
  const [chError, setChError] = useState('');

  // CH name search state
  const [chSearchQuery, setChSearchQuery] = useState('');
  const [chSearchResults, setChSearchResults] = useState<Array<{ companyNumber: string; name: string; status: string; address: string }>>([]);
  const [chSearchLoading, setChSearchLoading] = useState(false);
  const [chSearchOpen, setChSearchOpen] = useState(false);
  const chSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([]);
  const [dupChecked, setDupChecked] = useState(false);

  const needsCH = !NON_CH_TYPES.has(clientType);
  const labels = CLIENT_TYPE_LABELS[clientType] ?? CLIENT_TYPE_LABELS['limited']!;

  // ── CH lookup + duplicate check ──────────────────────────────────────────
  const lookupCH = useCallback(async (num: string) => {
    if (num.length < 6) { setChCompany(null); setChError(''); setDuplicates([]); setDupChecked(false); return; }
    setChLoading(true);
    setChError('');
    try {
      const [chRes, dupRes] = await Promise.all([
        fetch(`/api/companies-house/${encodeURIComponent(num)}`),
        fetch(`/api/onboarding/links/check-duplicate?companyNumber=${encodeURIComponent(num)}`),
      ]);
      if (chRes.ok) {
        const data = await chRes.json() as CHCompany;
        setChCompany(data);
        if (data.name) setClientName(data.name);
        if (data.address) setBusinessAddress(data.address);
      } else {
        setChCompany(null);
        setChError(chRes.status === 404 ? 'Company not found on Companies House' : 'Could not verify company number');
      }
      if (dupRes.ok) {
        const dupData = await dupRes.json() as { duplicates?: DuplicateResult[] };
        setDuplicates(dupData.duplicates || []);
      }
      setDupChecked(true);
    } catch {
      setChError('Failed to connect to Companies House');
    } finally {
      setChLoading(false);
    }
  }, []);

  // Debounced auto-lookup when CH number changes
  useEffect(() => {
    if (!needsCH) return;
    if (chTimer.current) clearTimeout(chTimer.current);
    if (companyNumber.length < 6) { setChCompany(null); setChError(''); setDuplicates([]); setDupChecked(false); return; }
    chTimer.current = setTimeout(() => lookupCH(companyNumber), 600);
    return () => { if (chTimer.current) clearTimeout(chTimer.current); };
  }, [companyNumber, needsCH, lookupCH]);

  // Debounced CH name search
  useEffect(() => {
    if (!needsCH) return;
    if (chSearchTimer.current) clearTimeout(chSearchTimer.current);
    if (chSearchQuery.length < 2) { setChSearchResults([]); return; }
    setChSearchLoading(true);
    chSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies-house/search?q=${encodeURIComponent(chSearchQuery)}`);
        if (res.ok) {
          const data = await res.json() as { items: Array<{ companyNumber: string; name: string; status: string; address: string }> };
          setChSearchResults(data.items || []);
        }
      } catch { /* ignore */ }
      setChSearchLoading(false);
    }, 400);
    return () => { if (chSearchTimer.current) clearTimeout(chSearchTimer.current); };
  }, [chSearchQuery, needsCH]);

  // When client type changes to a non-CH type, clear CH state and remove company-only services
  useEffect(() => {
    if (NON_CH_TYPES.has(clientType)) {
      setChCompany(null);
      setChError('');
      setDuplicates([]);
      setDupChecked(false);
      // Remove any selected company-only services
      setSelected((prev) => prev.filter((id) => {
        const vis = SERVICE_VISIBILITY[id];
        return !vis || vis.has(clientType);
      }));
    }
  }, [clientType]);

  // ── Resume a saved draft on mount ──────────────────────────────────────────
  useEffect(() => {
    const t = searchParams.get('draft');
    if (!t) { hydrated.current = true; return; }
    (async () => {
      const d = await loadWizardDraft(t);
      if (d) {
        if (d.firmSlug) setFirmSlug(d.firmSlug);
        setCompanyNumber(d.companyNumber || '');
        setDirectorEmail(d.directorEmail || '');
        const svc = d.services || [];
        setSelected(svc.filter((s) => !s.oneoff).map((s) => s.id));
        setSelectedOneoff(
          d.selectedOneoff?.length ? d.selectedOneoff : svc.filter((s) => s.oneoff).map((s) => s.id),
        );
        if (d.prices && Object.keys(d.prices).length) setPrices((prev) => ({ ...prev, ...d.prices }));
        if (d.customFees?.length) setCustomFees(d.customFees as CustomFee[]);
        if (d.scopeRows?.length) setScopeRows(d.scopeRows);
        if (d.frequencies) setFrequencies(d.frequencies as Record<string, Frequency>);
        if (d.paymentMethod) setPaymentMethod(d.paymentMethod as PaymentMethod);
        if (d.includeInLetter) setIncludeInLetter(d.includeInLetter as Record<string, boolean>);
        if (d.includeAnnexA !== undefined) setIncludeAnnexA(d.includeAnnexA as boolean);
        if (d.softwareItems?.length) setSoftwareItems(d.softwareItems as SoftwareItem[]);
        if (d.clientType) setClientType(d.clientType as string);
        if (d.clientName) setClientName(d.clientName);
        if (d.businessAddress) setBusinessAddress(d.businessAddress);
        if (d.oneoffScopes) setOneoffScopes(d.oneoffScopes as Record<string, string>);
        if (d.utr) setUtr(d.utr);
        setDraftToken(d.token);
        if (d.savedAt) setSavedAt(new Date(d.savedAt));
      }
      hydrated.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced autosave whenever the wizard state changes ────────────────────
  useEffect(() => {
    if (!hydrated.current) return;
    const hasContent = selected.length || selectedOneoff.length || customFees.length || companyNumber || directorEmail;
    if (!hasContent) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const selectedServices = [
        ...selected.map((id) => ({ id, name: SERVICES.find((s) => s.id === id)?.name || id, price: prices[id] || 0, oneoff: false })),
        ...selectedOneoff.map((id) => ({ id, name: ALL_ONEOFF.find((s) => s.id === id)?.name || id, price: prices[id] || 0, oneoff: true })),
      ];
      const token = await saveWizardDraft({
        token: draftToken,
        firmSlug,
        step: 'services',
        companyNumber,
        directorEmail,
        services: selectedServices,
        prices,
        selectedOneoff,
        customFees: customFees.filter((c) => c.description.trim() || c.title?.trim() || c.price),
        scopeRows,
        frequencies,
        paymentMethod,
        includeInLetter,
        includeAnnexA,
        softwareItems,
        clientType,
        clientName,
        businessAddress,
        oneoffScopes,
        utr,
      });
      if (token) {
        setSavedAt(new Date());
        if (token !== draftToken) {
          setDraftToken(token);
          const sp = new URLSearchParams(Array.from(searchParams.entries()));
          sp.set('draft', token);
          sp.set('firm', firmSlug);
          router.replace(`/onboarding/services?${sp.toString()}`);
        }
      }
    }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedOneoff, prices, customFees, scopeRows, companyNumber, directorEmail, firmSlug, draftToken, frequencies, paymentMethod, includeInLetter, includeAnnexA, softwareItems, clientType, clientName, businessAddress, oneoffScopes, utr]);

  const updateScope = (i: number, field: keyof ScopeRow, value: string) =>
    setScopeRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const toggleService = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleOneoff = (id: string) => {
    setSelectedOneoff((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const updatePrice = (id: string, value: string) => {
    const num = parseInt(value) || 0;
    setPrices((prev) => ({ ...prev, [id]: Math.max(0, num) }));
  };

  // Filter services by client type
  const visibleServices = SERVICES.filter((s) => {
    const vis = SERVICE_VISIBILITY[s.id];
    return !vis || vis.has(clientType);
  });

  const toMonthly = (price: number, freq: Frequency | undefined): number => {
    if (freq === 'annually') return price / 12;
    if (freq === 'quarterly') return price / 3;
    return price;
  };
  const toAnnual = (price: number, freq: Frequency | undefined): number => {
    if (freq === 'annually') return price;
    if (freq === 'quarterly') return price * 4;
    return price * 12;
  };

  const totalMonthly = selected.reduce((sum, id) => sum + toMonthly(prices[id] || 0, frequencies[id]), 0);
  const totalAnnual = selected.reduce((sum, id) => sum + toAnnual(prices[id] || 0, frequencies[id]), 0);
  const total = totalMonthly;
  const customTotal = customFees.reduce((sum, c) => {
    if (c.frequency === 'one-off') return sum + (c.price || 0);
    return sum + toMonthly(c.price || 0, c.frequency as Frequency | undefined);
  }, 0);
  const oneoffTotal = selectedOneoff.reduce((sum, id) => sum + (prices[id] || 0), 0)
    + customFees.filter((c) => c.frequency === 'one-off').reduce((s, c) => s + (c.price || 0), 0);

  const canContinue = selected.length > 0 && directorEmail && clientName.trim() && (needsCH ? companyNumber : true);

  const handleContinue = async () => {
    if (!canContinue) return;
    setLoading(true);
    const monthlyServices = selected.map((id) => ({
      id,
      name: SERVICES.find((s) => s.id === id)?.name || id,
      price: prices[id] || 0,
      frequency: frequencies[id] || 'monthly',
      oneoff: false,
    }));
    const oneoffServices = selectedOneoff.map((id) => ({
      id,
      name: ALL_ONEOFF.find((s) => s.id === id)?.name || id,
      price: prices[id] || 0,
      oneoff: true,
    }));
    const selectedServices = [...monthlyServices, ...oneoffServices];
    const cleanCustomFees = customFees.filter((c) => c.description.trim());
    // Only pass scope rows that were actually changed from the defaults
    const scopeChanged = JSON.stringify(scopeRows) !== JSON.stringify(DEFAULT_SCOPE_ROWS);

    const token = await saveWizardDraft({
      token: draftToken,
      firmSlug,
      step: 'company',
      companyNumber,
      directorEmail,
      services: selectedServices,
      prices,
      selectedOneoff,
      customFees: cleanCustomFees,
      scopeRows,
      frequencies,
      paymentMethod,
      includeInLetter,
      includeAnnexA,
      softwareItems,
      clientType,
      clientName,
      businessAddress,
      oneoffScopes,
      utr,
    });
    const dt = token || draftToken;

    const q = new URLSearchParams();
    q.set('firm', firmSlug);
    q.set('services', selected.join(','));
    q.set('prices', JSON.stringify(prices));
    q.set('serviceDetails', JSON.stringify(selectedServices));
    q.set('companyNumber', companyNumber);
    q.set('directorEmail', directorEmail);
    q.set('customFees', JSON.stringify(cleanCustomFees));
    if (scopeChanged) q.set('scopeRows', JSON.stringify(scopeRows));
    q.set('paymentMethod', paymentMethod);
    q.set('includeAnnexA', includeAnnexA ? '1' : '0');
    q.set('frequencies', JSON.stringify(frequencies));
    q.set('softwareItems', JSON.stringify(softwareItems));
    q.set('includeInLetter', JSON.stringify(includeInLetter));
    q.set('clientType', clientType);
    q.set('clientName', clientName);
    q.set('businessAddress', businessAddress);
    if (utr.trim()) q.set('utr', utr.trim());
    if (Object.keys(oneoffScopes).length) q.set('oneoffScopes', JSON.stringify(oneoffScopes));
    if (dt) q.set('draft', dt);
    router.push(`/onboarding/company?${q.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-purple-600 font-semibold">Step 2</span>
              <span>Services & Company</span>
            </div>
            {savedAt && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium" aria-live="polite">
                <Check size={13} aria-hidden="true" />
                Progress saved {savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="mt-2 h-1 bg-gray-200 rounded-full">
            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full w-1/3" />
          </div>
        </div>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Services & Company Details
          </h1>
          <p className="text-gray-600">
            Select services and enter your company number. You can adjust pricing per service.
          </p>
        </div>

        {/* Client type + Payment method + Annex A toggles — MOVED BEFORE company details */}
        <div className="mb-8 p-5 bg-white border border-gray-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Client Type</p>
              <p className="text-xs text-gray-500">Determines required fields and available services</p>
            </div>
            <select
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="limited">Limited Company</option>
              <option value="sole_trader">Sole Trader</option>
              <option value="btl">Buy-to-Let Individual</option>
              <option value="partnership">Partnership</option>
              <option value="llp">LLP</option>
              <option value="individual">Individual</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Payment Method</p>
              <p className="text-xs text-gray-500">How the client pays their monthly fees</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button type="button" onClick={() => setPaymentMethod('dd')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${paymentMethod === 'dd' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                Direct Debit
              </button>
              <button type="button" onClick={() => setPaymentMethod('manual')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${paymentMethod === 'manual' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                Manual Invoice
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Include Annex A (Schedule of Service Charges)</p>
              <p className="text-xs text-gray-500">Append the full SSC pricing schedule to the engagement letter</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={includeAnnexA} onChange={(e) => setIncludeAnnexA(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
            </label>
          </div>
        </div>

        {/* Company / Client Details */}
        <div className="mb-10 p-6 bg-purple-50 border border-purple-200 rounded-xl space-y-4">
          {needsCH && (<>
            {/* CH name search */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search Companies House by Name
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Type a company name to search..."
                  value={chSearchQuery}
                  onChange={(e) => { setChSearchQuery(e.target.value); setChSearchOpen(true); }}
                  onFocus={() => chSearchResults.length > 0 && setChSearchOpen(true)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                />
                {chSearchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 size={16} className="animate-spin text-purple-500" />
                  </div>
                )}
              </div>
              {chSearchOpen && chSearchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {chSearchResults.map((r) => (
                    <button
                      key={r.companyNumber}
                      type="button"
                      onClick={() => {
                        setCompanyNumber(r.companyNumber);
                        setClientName(r.name);
                        setChSearchQuery(r.name);
                        setChSearchOpen(false);
                        lookupCH(r.companyNumber);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.companyNumber} · {r.status}{r.address ? ` · ${r.address}` : ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-xs text-gray-400 font-medium">or enter company number directly</span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            {/* CH number input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Company Registration Number *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g., 12345678"
                  value={companyNumber}
                  onChange={(e) => setCompanyNumber(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white pr-10"
                  maxLength={10}
                />
                {chLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 size={18} className="animate-spin text-purple-500" />
                  </div>
                )}
                {!chLoading && chCompany && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle2 size={18} className="text-green-500" />
                  </div>
                )}
                {!chLoading && chError && companyNumber.length >= 6 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <AlertTriangle size={18} className="text-amber-500" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                We&apos;ll verify this with Companies House automatically (e.g. 08086819 or OC428532)
              </p>

              {/* CH lookup result */}
              {chCompany && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Building2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-green-900">{chCompany.name}</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        {chCompany.number} · Status: <span className="font-medium">{chCompany.status}</span>
                      </p>
                      {chCompany.address && (
                        <p className="text-xs text-green-600 mt-0.5">{chCompany.address}</p>
                      )}
                      {chCompany.officers?.length > 0 && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Directors: {chCompany.officers.map((o) => o.name).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CH error */}
              {chError && companyNumber.length >= 6 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-800">{chError}</p>
                </div>
              )}

              {/* Duplicate warning */}
              {duplicates.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-900">Existing client found with this company number:</p>
                      {duplicates.map((d) => (
                        <p key={d.token} className="text-xs text-red-700 mt-1">
                          {d.companyName} — Status: <span className="font-semibold">{d.status}</span>
                          {d.sentAt ? ` · Sent ${new Date(d.sentAt).toLocaleDateString('en-GB')}` : ''}
                        </p>
                      ))}
                      <p className="text-xs text-red-600 mt-1">You can still proceed if this is intentional.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>)}

          {!needsCH && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
              <Search size={14} className="text-blue-600 flex-shrink-0" />
              <p className="text-xs text-blue-800">
                {clientType === 'btl' ? 'Buy-to-Let individuals' : clientType === 'sole_trader' ? 'Sole traders' : clientType === 'partnership' ? 'Partnerships' : 'Individuals'} do not require a Companies House registration number.
              </p>
            </div>
          )}

          {/* Client / Business Name — always shown */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {needsCH ? 'Company Name *' : clientType === 'sole_trader' ? 'Business / Trading Name *' : clientType === 'btl' ? 'Client Full Name *' : clientType === 'partnership' ? 'Partnership Name *' : 'Client Full Name *'}
            </label>
            <input
              type="text"
              placeholder={needsCH ? 'Auto-filled from Companies House' : 'e.g., John Smith or Smith Trading'}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* Business Address — always shown */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {needsCH ? 'Registered Office Address' : 'Business / Correspondence Address'}
            </label>
            <input
              type="text"
              placeholder={needsCH ? 'Auto-filled from Companies House' : 'Enter address'}
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* UTR — most relevant for sole traders / individuals / partnerships / BTL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {clientType === 'partnership' ? 'Partnership UTR' : 'Unique Taxpayer Reference (UTR)'}
              {needsCH ? ' (optional)' : ''}
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="10-digit HMRC UTR, e.g. 1234567890"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/[^0-9\s]/g, ''))}
              maxLength={13}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Shown on the engagement letter for self-assessment and non-company clients.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {labels!.contactLabel}
            </label>
            <input
              type="email"
              placeholder="director@company.com"
              value={directorEmail}
              onChange={(e) => setDirectorEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              {labels!.emailHint}
            </p>
          </div>
        </div>

        {/* Services grid — filtered by client type */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {visibleServices.map((service) => (
            <div
              key={service.id}
              onClick={() => toggleService(service.id)}
              className={`p-6 rounded-xl border-2 transition-all text-left group cursor-pointer ${
                selected.includes(service.id)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-purple-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                  <p className="text-xs text-purple-600 mt-1 font-medium">Includes: {service.threshold}</p>
                </div>

                {/* Checkbox */}
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selected.includes(service.id)
                      ? 'bg-purple-500 border-purple-500'
                      : 'border-gray-300'
                  }`}
                >
                  {selected.includes(service.id) && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>

              {/* Price + frequency + scope inputs - only show if selected */}
              {selected.includes(service.id) && (
                <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-600">£</span>
                    <input
                      type="number"
                      value={prices[service.id]}
                      onChange={(e) => updatePrice(service.id, e.target.value)}
                      className="w-20 px-3 py-2 border border-purple-300 rounded text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min="0"
                    />
                    <select
                      value={frequencies[service.id] || 'monthly'}
                      onChange={(e) => setFrequencies((prev) => ({ ...prev, [service.id]: e.target.value as Frequency }))}
                      className="px-2 py-2 border border-purple-300 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="monthly">/month</option>
                      <option value="quarterly">/quarter</option>
                      <option value="annually">/year</option>
                    </select>
                  </div>
                  {(frequencies[service.id] || 'monthly') !== 'monthly' && (
                    <p className="text-xs text-gray-500">
                      = £{((prices[service.id] || 0) / ((frequencies[service.id] || 'monthly') === 'quarterly' ? 3 : 12)).toFixed(0)}/month
                      {' · '}£{((prices[service.id] || 0) * ((frequencies[service.id] || 'monthly') === 'quarterly' ? 4 : 1)).toFixed(0)}/year
                    </p>
                  )}
                  {(frequencies[service.id] || 'monthly') === 'monthly' && (
                    <p className="text-xs text-gray-500">= £{((prices[service.id] || 0) * 12).toLocaleString('en-GB')}/year</p>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeInLetter[service.id] !== false}
                      onChange={(e) => setIncludeInLetter((prev) => ({ ...prev, [service.id]: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded text-purple-600" />
                    <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Include in engagement letter</span>
                  </label>
                  {SCOPE_MAP[service.id] !== undefined && (
                    <div className="space-y-2 border-t border-purple-100 pt-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-1">
                          Included in scope (shown on contract)
                        </label>
                        <input
                          type="text"
                          value={scopeRows[SCOPE_MAP[service.id]!]!.threshold}
                          onChange={(e) => updateScope(SCOPE_MAP[service.id]!, 'threshold', e.target.value)}
                          className="w-full px-3 py-1.5 border border-purple-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-1">
                          Fee exceeding scope
                        </label>
                        <input
                          type="text"
                          value={scopeRows[SCOPE_MAP[service.id]!]!.excess}
                          onChange={(e) => updateScope(SCOPE_MAP[service.id]!, 'excess', e.target.value)}
                          className="w-full px-3 py-1.5 border border-purple-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                        />
                      </div>
                    </div>
                  )}
                  {service.id === 'software_subscription' && (
                    <div className="space-y-2 border-t border-purple-100 pt-3">
                      <label className="block text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-1">Software Items</label>
                      {softwareItems.map((sw, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="text" value={sw.name} onChange={(e) => setSoftwareItems((prev) => prev.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))}
                            placeholder="e.g. QuickBooks" className="flex-1 px-2 py-1.5 border border-purple-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white" />
                          <span className="text-xs text-gray-500">£</span>
                          <input type="number" value={sw.price} onChange={(e) => setSoftwareItems((prev) => prev.map((x, xi) => xi === i ? { ...x, price: Math.max(0, parseInt(e.target.value) || 0) } : x))}
                            className="w-16 px-2 py-1.5 border border-purple-200 rounded text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500" min="0" />
                          {softwareItems.length > 1 && (
                            <button type="button" onClick={() => setSoftwareItems((prev) => prev.filter((_, xi) => xi !== i))} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setSoftwareItems((prev) => [...prev, { name: '', price: 0 }])}
                        className="flex items-center gap-1 text-[10px] font-semibold text-purple-600 hover:text-purple-800"><Plus size={11} /> Add software</button>
                      <p className="text-xs text-gray-500 font-medium">Total: £{softwareItems.reduce((s, x) => s + x.price, 0)}/month</p>
                    </div>
                  )}
                </div>
              )}

              {/* Default price - show if not selected */}
              {!selected.includes(service.id) && (
                <div className="mt-3 text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">£{service.basePrice}</span>
                  <span className="text-gray-500">/month</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* One-off / ad-hoc services (Annex A — SSC) — always-editable prices */}
        <div className="mb-8 border border-gray-200 rounded-xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setOneoffExpanded(!oneoffExpanded)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
          >
            <div>
              <h3 className="font-semibold text-gray-900">Additional / One-off Services</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Ad-hoc services from our Schedule of Service Charges (Annex A){selectedOneoff.length > 0 ? ` · ${selectedOneoff.length} added` : ''}
              </p>
            </div>
            {oneoffExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </button>

          {oneoffExpanded && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-6">
              {ONEOFF_GROUPS.map((grp) => (
                <div key={grp.group}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{grp.group}</p>
                  <div className="space-y-2">
                    {grp.items.map((item) => {
                      const isSel = selectedOneoff.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg border transition-all ${
                            isSel ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleOneoff(item.id)}
                              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                isSel ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                              }`}
                            >
                              {isSel && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleOneoff(item.id)}>
                              <p className="text-sm font-medium text-gray-900">{item.name}</p>
                              {item.note && <p className="text-xs text-gray-500">{item.note}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-sm text-gray-600">£</span>
                              <input
                                type="number"
                                value={prices[item.id]}
                                onChange={(e) => updatePrice(item.id, e.target.value)}
                                className={`w-20 px-2 py-1.5 border rounded text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                                  isSel ? 'border-purple-300 bg-white' : 'border-gray-200 bg-gray-50'
                                }`}
                                min="0"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                          {isSel && (
                            <div className="mt-2 pl-8">
                              <input
                                type="text"
                                placeholder="Scope of work (e.g., single property, 2024/25 tax year)"
                                value={oneoffScopes[item.id] || ''}
                                onChange={(e) => setOneoffScopes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                className="w-full px-3 py-1.5 border border-purple-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom / additional fee boxes */}
        <div className="mb-8 border border-gray-200 rounded-xl bg-white p-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-semibold text-gray-900">Additional Fees</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Catch-up work, bespoke services, or any additional charges — fully customisable boxes with editable titles and descriptions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCustomFees((prev) => [...prev, { title: '', description: '', price: 0, frequency: 'one-off' }])}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 flex-shrink-0"
            >
              <Plus size={15} /> Add fee
            </button>
          </div>
          {customFees.length > 0 && (
            <div className="mt-4 space-y-3">
              {customFees.map((c, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400 w-6 text-right flex-shrink-0">{i + 1}.</span>
                    <input
                      type="text"
                      value={c.title || ''}
                      onChange={(e) => setCustomFees((prev) => prev.map((x, xi) => xi === i ? { ...x, title: e.target.value } : x))}
                      placeholder="Fee title (e.g., Catch-up Bookkeeping)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button type="button" onClick={() => setCustomFees((prev) => prev.filter((_, xi) => xi !== i))}
                      className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="pl-8">
                    <textarea
                      value={c.description}
                      onChange={(e) => setCustomFees((prev) => prev.map((x, xi) => xi === i ? { ...x, description: e.target.value } : x))}
                      placeholder="Description (optional) — shown on the engagement letter"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-600">£</span>
                        <input
                          type="number"
                          value={c.price || ''}
                          onChange={(e) => setCustomFees((prev) => prev.map((x, xi) => xi === i ? { ...x, price: Math.max(0, parseInt(e.target.value) || 0) } : x))}
                          className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                          min="0" placeholder="0"
                        />
                      </div>
                      <select value={c.frequency || 'one-off'}
                        onChange={(e) => setCustomFees((prev) => prev.map((x, xi) => xi === i ? { ...x, frequency: e.target.value as CustomFee['frequency'] } : x))}
                        className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                        <option value="one-off">One-off</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annually">Annually</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-right text-sm font-semibold text-gray-700 pt-1">Additional fees total: £{customTotal.toLocaleString('en-GB')}</p>
            </div>
          )}
        </div>

        {/* Price summary */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Services</p>
              <p className="text-2xl font-bold text-gray-900">
                £{totalMonthly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-lg text-gray-500 ml-1">/month</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {selected.length} service{selected.length !== 1 ? 's' : ''} · £{totalAnnual.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year · {paymentMethod === 'dd' ? 'Direct Debit' : 'Manual invoice'}
              </p>
            </div>
            <div className="text-right">
              {oneoffTotal > 0 ? (
                <>
                  <p className="text-xs text-gray-500 mb-2">One-off / Additional</p>
                  <p className="text-2xl font-bold text-purple-600">£{oneoffTotal.toLocaleString('en-GB')}</p>
                  <p className="text-xs text-purple-600">
                    {selectedOneoff.length + customFees.filter((c) => (c.title || c.description || '').trim()).length} item{(selectedOneoff.length + customFees.filter((c) => (c.title || c.description || '').trim()).length) !== 1 ? 's' : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">Annual equivalent</p>
                  <p className="text-2xl font-bold text-purple-600">£{totalAnnual.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-purple-600">+ VAT</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-6 py-3 text-gray-700 hover:text-gray-900 font-semibold transition-colors"
          >
            <ChevronLeft size={20} />
            Back
          </button>

          <button
            onClick={handleContinue}
            disabled={!canContinue || loading}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
              !canContinue
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105'
            }`}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            Continue
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={32} />
      </div>
    }>
      <ServicesPageInner />
    </Suspense>
  );
}
