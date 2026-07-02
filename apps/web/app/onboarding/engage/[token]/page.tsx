'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { AlertCircle, Clock, CheckCircle2, FileText, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { getFirm } from '@/lib/firms';
import { LetterTerms, ScheduleOfServices } from './_terms';

// Documents the DIRECTOR personally provides (KYC / ID). Collected at signing
// via a status dropdown — fine if not ready now, we follow up every 2 days.
const DIRECTOR_DOCS = [
  { id: 'photo_id', label: 'Photo ID', description: 'Passport or driving licence' },
  { id: 'proof_address', label: 'Proof of Address', description: 'Utility bill or bank statement (less than 3 months old)' },
];

// Documents relating to the COMPANY / accounting records.
const COMPANY_DOCS = [
  { id: 'companies_house', label: 'Companies House documents', description: 'Certificate of incorporation and latest confirmation statement' },
  { id: 'hmrc_utr', label: 'HMRC UTR Number', description: 'Your Unique Taxpayer Reference' },
  { id: 'vat_reg', label: 'VAT Registration Certificate', description: 'If VAT registered' },
  { id: 'prev_accounts', label: 'Previous Accounts', description: 'Last 2 years statutory accounts if available' },
  { id: 'bank_details', label: 'Bank Account Details', description: 'Business bank account information' },
  { id: 'payroll_records', label: 'Payroll Records', description: 'If you have employees — payroll history' },
  { id: 'software_access', label: 'Accounting Software Access', description: 'Login credentials for Xero, QuickBooks, Sage etc.' },
];

const DOC_STATUS_OPTIONS = [
  { value: 'ready', label: 'I have this ready to upload' },
  { value: 'later', label: "I'll send this within a few days" },
  { value: 'na', label: 'Not applicable to me' },
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
}

interface ChData {
  number: string;
  name: string;
  address: string;
  status: string;
  incorporationDate: string | null;
  aaDue: string | null;
  csDue: string | null;
  natureOfBusiness: string | null;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

export default function EngagementPage() {
  const params = useParams();
  const token = params.token as string;

  const [link, setLink] = useState<OnboardingLinkData | null>(null);
  const [ch, setCh] = useState<ChData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Previous accountant fields
  const [prevFirmName, setPrevFirmName] = useState('');
  const [prevEmail, setPrevEmail] = useState('');
  const [prevPhone, setPrevPhone] = useState('');
  const [noPrevAccountant, setNoPrevAccountant] = useState(false);

  // Document status — director provides ID docs, company records tracked too.
  // Default everything to 'later' so nothing blocks signing; we chase after.
  const [docStatus, setDocStatus] = useState<Record<string, string>>({});

  // Declaration + typed signature (contract format)
  const [authorised, setAuthorised] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  // Direct debit mandate details (optional — GoCardless setup)
  const [ddName, setDdName] = useState('');
  const [ddAccountNo, setDdAccountNo] = useState('');
  const [ddSortCode, setDdSortCode] = useState('');
  const [ddBankAddress, setDdBankAddress] = useState('');

  // Contact preferences (Data Protection section (c))
  const [contactPrefs, setContactPrefs] = useState<Record<string, boolean>>({ email: true });

  // Sections open/closed
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(true);

  useEffect(() => {
    fetch(`/api/onboarding/links/${token}`)
      .then((r) => r.json())
      .then((data) => {
        setLink(data);
        if (data?.directorName) setSignatureName(data.directorName);
        // Pull live Companies House data for the contract (best-effort)
        if (data?.companyNumber) {
          fetch(`/api/companies-house/${data.companyNumber}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((c) => c && !c.error && setCh(c))
            .catch(() => {});
        }
      })
      .catch(() => setPageError('Link not found or invalid'))
      .finally(() => setLoading(false));
  }, [token]);

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

  const expiresAt = new Date(link.expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft <= 0;
  const isExpiringSoon = daysLeft > 0 && daysLeft <= 7;

  const firm = getFirm(link.firmSlug || 'gns');
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const monthlyServices = (link.services || []).filter((s) => !s.oneoff);
  const oneoffServices = (link.services || []).filter((s) => s.oneoff);
  const totalMonthly = monthlyServices.reduce((s, sv) => s + sv.price, 0);
  const totalOneoff = oneoffServices.reduce((s, sv) => s + sv.price, 0);

  const clientAddress = ch?.address || '';

  const canSubmit = authorised && signatureName.trim().length > 1
    && (noPrevAccountant || (prevFirmName && prevEmail && prevPhone)) && !isExpired;

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
          companyDocs: COMPANY_DOCS.map((d) => ({ id: d.id, label: d.label, status: docStatus[d.id] || 'later' })),
          signatureName: signatureName.trim(),
          contactPrefs: CONTACT_PREFS.filter((p) => contactPrefs[p.id]).map((p) => p.id),
          directDebit: (ddName || ddAccountNo || ddSortCode) ? {
            accountName: ddName, accountNumber: ddAccountNo, sortCode: ddSortCode, bankAddress: ddBankAddress,
          } : null,
          authorised: true,
        }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-xl w-full bg-white rounded-2xl p-10 shadow-lg text-center">
        <div className="inline-flex mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-40" />
            <CheckCircle2 className="text-green-500 relative" size={72} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Engagement Signed!</h1>
        <p className="text-gray-600 mb-6">
          Thank you, <strong>{signatureName || link.directorName}</strong>. Your contract with <strong>{firm.legalName}</strong> has been signed and confirmed.
        </p>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-left space-y-2 mb-6">
          <p className="text-sm text-gray-700">✅ Confirmation email sent to <strong>{link.clientEmail}</strong></p>
          {!noPrevAccountant && prevEmail && (
            <p className="text-sm text-gray-700">✅ Professional clearance request sent to <strong>{prevEmail}</strong></p>
          )}
          <p className="text-sm text-gray-700">✅ {firm.name} has been notified</p>
        </div>
        <p className="text-sm text-gray-500">A member of our team will be in touch within 2 business days.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-200 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

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
              <p className="text-sm text-red-700 mt-1">Please complete this before {expiresAt.toLocaleDateString('en-GB')} or the link will no longer be valid.</p>
            </div>
          </div>
        )}

        {/* ═══════════ THE CONTRACT DOCUMENT ═══════════ */}
        <div className="bg-white shadow-lg border border-gray-300" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>

          {/* Letterhead */}
          <div className="px-10 pt-8 pb-5 border-b-2" style={{ borderColor: firm.accentColor }}>
            <div className="flex justify-between items-start gap-4">
              <Image src={firm.logo} alt={firm.name} width={170} height={90} className="object-contain" priority />
              <div className="text-right text-[12px] text-gray-600 leading-relaxed">
                <p className="font-bold text-gray-900 text-[13px]">{firm.legalName}</p>
                <p>{firm.address}</p>
                <p>{firm.city}, {firm.postcode}</p>
                <p>{firm.phone}</p>
                <p>{firm.email}</p>
              </div>
            </div>
            <div className="flex justify-between items-end mt-4">
              <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">Private &amp; Confidential</p>
              <p className="text-[13px] text-gray-700">Date: <strong>{today}</strong></p>
            </div>
          </div>

          <div className="px-10 py-7">

            {/* Parties */}
            <h1 className="text-center text-[17px] font-bold text-gray-900 mb-4">Contract for Services between</h1>
            <p className="text-center text-[13.5px] text-gray-800 leading-relaxed mb-1">
              <strong>{firm.legalName.toUpperCase()}</strong>, {firm.address}, {firm.city} {firm.postcode} (&lsquo;The Accountants&rsquo;) &amp;
            </p>
            <p className="text-center text-[13.5px] text-gray-800 leading-relaxed mb-3">
              <strong>{link.companyName.toUpperCase()}</strong>{clientAddress ? `, ${clientAddress}` : ''} (&lsquo;The Client&rsquo;)
            </p>
            <p className="text-center text-[12px] italic text-gray-600 mb-6">
              This Fee Structure and quotation is an integral part of the engagement letter.
            </p>

            {/* Companies House verified details */}
            {ch && (
              <div className="border border-gray-300 rounded mb-6 text-[12.5px]">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-300 font-bold text-gray-800" style={{ fontFamily: 'Arial, sans-serif' }}>
                  Company Details — verified with Companies House
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-4 py-3 text-gray-700">
                  <p><span className="text-gray-500">Company No:</span> <strong>{ch.number}</strong></p>
                  <p><span className="text-gray-500">Status:</span> <strong className="capitalize">{ch.status}</strong></p>
                  <p className="col-span-2"><span className="text-gray-500">Registered Office:</span> {ch.address}</p>
                  {ch.incorporationDate && <p><span className="text-gray-500">Incorporated:</span> {fmtDate(ch.incorporationDate)}</p>}
                  {ch.natureOfBusiness && <p><span className="text-gray-500">SIC Code(s):</span> {ch.natureOfBusiness}</p>}
                  {ch.aaDue && <p><span className="text-gray-500">Accounts due:</span> {fmtDate(ch.aaDue)}</p>}
                  {ch.csDue && <p><span className="text-gray-500">Confirmation statement due:</span> {fmtDate(ch.csDue)}</p>}
                </div>
              </div>
            )}

            {/* ── Fee Structure table (template format) ── */}
            <table className="w-full border-collapse text-[12.5px] mb-2" style={{ fontFamily: 'Arial, sans-serif' }}>
              <thead>
                <tr className="text-white" style={{ background: firm.accentColor }}>
                  <th className="border border-gray-400 px-3 py-2 text-left">Fees</th>
                  <th className="border border-gray-400 px-3 py-2 text-right w-24">Monthly £</th>
                  <th className="border border-gray-400 px-3 py-2 text-right w-28">Fees Upfront £</th>
                  <th className="border border-gray-400 px-3 py-2 text-right w-32">Annual Equivalent £</th>
                  <th className="border border-gray-400 px-3 py-2 text-left w-28">Payment Mode</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                <tr>
                  <td className="border border-gray-300 px-3 py-2 font-semibold">Fees Agreed</td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-semibold">£{totalMonthly.toFixed(2)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">—</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">£{(totalMonthly * 12).toFixed(2)}</td>
                  <td className="border border-gray-300 px-3 py-2">Monthly DD</td>
                </tr>
                {monthlyServices.map((s, i) => (
                  <tr key={`m-${i}`} className="text-gray-600">
                    <td className="border border-gray-300 px-3 py-1.5 pl-6 text-[12px]">• {s.name}</td>
                    <td className="border border-gray-300 px-3 py-1.5 text-right text-[12px]">£{s.price.toFixed(2)}</td>
                    <td className="border border-gray-300 px-3 py-1.5"></td>
                    <td className="border border-gray-300 px-3 py-1.5 text-right text-[12px]">£{(s.price * 12).toFixed(2)}</td>
                    <td className="border border-gray-300 px-3 py-1.5"></td>
                  </tr>
                ))}
                {oneoffServices.length > 0 && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="border border-gray-300 px-3 py-2 font-semibold">
                      Fees for any past due filings and ad-hoc work (IF ANY)
                    </td>
                  </tr>
                )}
                {oneoffServices.map((s, i) => (
                  <tr key={`o-${i}`}>
                    <td className="border border-gray-300 px-3 py-1.5 pl-6 text-[12px]">• {s.name}</td>
                    <td className="border border-gray-300 px-3 py-1.5"></td>
                    <td className="border border-gray-300 px-3 py-1.5 text-right text-[12px]">£{s.price.toFixed(2)}</td>
                    <td className="border border-gray-300 px-3 py-1.5"></td>
                    <td className="border border-gray-300 px-3 py-1.5 text-[12px]">One off upfront</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-400 px-3 py-2">Final Monthly and One off Fees Agreed</td>
                  <td className="border border-gray-400 px-3 py-2 text-right">£{totalMonthly.toFixed(2)}</td>
                  <td className="border border-gray-400 px-3 py-2 text-right">£{totalOneoff.toFixed(2)}</td>
                  <td className="border border-gray-400 px-3 py-2 text-right">£{(totalMonthly * 12).toFixed(2)}</td>
                  <td className="border border-gray-400 px-3 py-2 text-[11px] leading-tight">Monthly DD<br />One off Upfront</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[12px] font-semibold text-gray-700 mb-6" style={{ fontFamily: 'Arial, sans-serif' }}>
              Note: 20% VAT applies to all above
            </p>

            {/* ── Direct Debit mandate (GoCardless) ── */}
            <div className="border-2 border-gray-400 rounded mb-6" style={{ fontFamily: 'Arial, sans-serif' }}>
              <div className="px-4 py-2 bg-gray-100 border-b border-gray-300">
                <p className="text-[13px] font-bold text-gray-900">Direct Debit Details (GoCardless)</p>
                <p className="text-[11px] text-gray-500">Optional now — used solely to set up your Direct Debit mandate. You can also provide these later.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4 px-4 py-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Account Holder&apos;s Name</label>
                  <input type="text" value={ddName} onChange={(e) => setDdName(e.target.value)} disabled={isExpired}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Account Number</label>
                  <input type="text" inputMode="numeric" maxLength={8} value={ddAccountNo} onChange={(e) => setDdAccountNo(e.target.value.replace(/\D/g, ''))} disabled={isExpired}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Sort Code</label>
                  <input type="text" inputMode="numeric" maxLength={8} placeholder="00-00-00" value={ddSortCode} onChange={(e) => setDdSortCode(e.target.value)} disabled={isExpired}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Address as per Bank</label>
                  <input type="text" value={ddBankAddress} onChange={(e) => setDdBankAddress(e.target.value)} disabled={isExpired}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <p className="px-4 pb-4 text-[12px] text-gray-700 leading-relaxed">
                I authorise {firm.name} to collect my fees using GoCardless direct debit and I hereby authorise the use of my
                above bank details for direct debit setup on my behalf. I have read this contract and am fully aware of the
                terms, including but not limited to fees and scope/exclusions mentioned herein.
              </p>
            </div>

            {/* Important! */}
            <div className="border-2 rounded p-4 mb-6" style={{ borderColor: firm.accentColor, background: '#fff8f8', fontFamily: 'Arial, sans-serif' }}>
              <p className="text-[13px] font-bold mb-1" style={{ color: firm.accentColor }}>Important!</p>
              <p className="text-[12.5px] text-gray-800 leading-relaxed">
                Please read the contract to the last page and return to the signature section. <strong>Do not sign unless you
                have read and understood the contract in its entirety.</strong> The signature section is at the bottom of this page.
              </p>
            </div>

            {/* ── Scope of Services table ── */}
            <p className="text-[12.5px] font-semibold text-gray-800 mb-2" style={{ fontFamily: 'Arial, sans-serif' }}>
              Services not covered below will be as per our Schedule of Service Charges (SSC) included in Annex A of this contract (last page).
            </p>
            <div className="overflow-x-auto mb-8">
              <table className="w-full border-collapse text-[12px]" style={{ fontFamily: 'Arial, sans-serif' }}>
                <thead>
                  <tr className="text-white" style={{ background: '#374151' }}>
                    <th className="border border-gray-400 px-3 py-2 text-left w-1/3">Scope of Services</th>
                    <th className="border border-gray-400 px-3 py-2 text-left w-1/3">Coverage Threshold (What is included?)</th>
                    <th className="border border-gray-400 px-3 py-2 text-left">Fee Exceeding Scope</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {[
                    ['Annual Accounts and Corporation Tax', 'Yearly Turnover ≤ £200,000', 'To be agreed later'],
                    ['Bookkeeping and Quarterly VAT Returns Filing', 'Turnover: As Above · Volume: 300 transactions per quarter (total of Bank Statement Lines + Purchase Bills + Sales Invoices)', '£0.95 per transaction'],
                    ['PAYE and Pension', '2 persons including directors', 'One off Setup: £10+VAT per staff · Ongoing: £10+VAT per staff per pay run'],
                    ['CIS', 'NA', '£10+VAT per subcontractor per month'],
                    ['Self-Assessment (Excluding: Buy-to-Let)', '2 persons including directors', '£200+VAT per year for additional person · Rental Property: To be Agreed Later'],
                    ['Confirmation Statement Filing to Companies House', 'Once a Year', '£50+VAT for additional filing'],
                    ['References and Letters', '1 Letter or 1 Reference Included', '£75+VAT for additional reference / letter'],
                  ].map(([service, threshold, excess], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-3 py-2 font-medium">{service}</td>
                      <td className="border border-gray-300 px-3 py-2">{threshold}</td>
                      <td className="border border-gray-300 px-3 py-2">{excess}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Full letter body (exact template text) ── */}
            <div className="border-t-2 border-gray-300 pt-5">
              <button
                type="button"
                onClick={() => setTermsExpanded(!termsExpanded)}
                className="w-full flex items-center justify-between mb-3 text-left"
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                <p className="text-[14px] font-bold text-gray-900">Letter of Engagement — Terms &amp; Conditions</p>
                {termsExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>
              {termsExpanded && (
                <>
                  <LetterTerms firm={firm} companyName={link.companyName} />

                  {/* (c) Other services — contact preferences (interactive) */}
                  <div className="border border-gray-300 rounded p-4 my-4" style={{ fontFamily: 'Arial, sans-serif' }}>
                    <p className="text-[13px] font-bold text-gray-900 mb-1">(c) Other services — contact preferences</p>
                    <p className="text-[12.5px] text-gray-700 mb-3">
                      From time to time we would like to contact you with details of other services we provide. If you consent
                      to us contacting you for this purpose, please confirm by selecting your preferred contact methods:
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {CONTACT_PREFS.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!contactPrefs[p.id]}
                            onChange={(e) => setContactPrefs((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                            className="w-4 h-4 rounded text-purple-600"
                          />
                          <span className="text-[12.5px] text-gray-800">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded p-4 my-4 bg-gray-50" style={{ fontFamily: 'Arial, sans-serif' }}>
                    <p className="text-[13px] font-bold text-gray-900 mb-2">Please confirm your agreement to:</p>
                    <ul className="list-disc pl-5 space-y-1 text-[12.5px] text-gray-700">
                      <li>the terms of this letter</li>
                      <li>the attached schedule(s) of services</li>
                      <li>the privacy notice and associated data protection matters</li>
                      <li>the standard terms and conditions</li>
                    </ul>
                  </div>

                  <div className="border-t-2 border-gray-300 mt-6 pt-5">
                    <ScheduleOfServices />
                  </div>
                </>
              )}
            </div>

            {/* ── Annex A: Schedule of Service Charges ── */}
            <div className="border-t-2 border-gray-300 pt-5 mt-6" style={{ fontFamily: 'Arial, sans-serif' }}>
              <p className="font-bold text-gray-900 text-[14px] mb-1">Annex A: Schedule of Service Charges (SSC)</p>
              <p className="text-xs text-gray-500 mb-3">Ad-hoc and specialist services not included in your monthly fee are charged as follows:</p>

              <p className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Self-Assessment (SA) Tax Return (SATR)</p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-gray-100"><th className="text-left px-2 py-1.5 border border-gray-300">Service</th><th className="text-right px-2 py-1.5 border border-gray-300">Single</th><th className="text-right px-2 py-1.5 border border-gray-300">Couple</th></tr></thead>
                  <tbody className="text-gray-700">
                    {[
                      ['Buy to Let SA Filing', '£250+VAT', '£350+VAT'],
                      ['Director and other SA (Salary, Dividend)', '£200+VAT', '£375+VAT'],
                      ['Sole Trader (Self Employed with GNS to do bookkeeping)', '£350+VAT', 'NA'],
                      ['Change of Beneficial Ownership for Rental Property Owners', '£500+VAT (New)', '£400+VAT (Existing)'],
                    ].map(([s, a, b], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 border border-gray-300">{s}</td>
                        <td className="px-2 py-1.5 border border-gray-300 text-right">{a}</td>
                        <td className="px-2 py-1.5 border border-gray-300 text-right">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">MTD Filing for Self-Assessment and Annual Summary</p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-gray-100"><th className="text-left px-2 py-1.5 border border-gray-300">Service</th><th className="text-right px-2 py-1.5 border border-gray-300">Single</th><th className="text-right px-2 py-1.5 border border-gray-300">Couple</th></tr></thead>
                  <tbody className="text-gray-700">
                    {[
                      ['Quarterly', '£75+VAT / quarter', '£150+VAT / quarter'],
                      ['Annual Summary Filing', 'Free', 'Free'],
                      ['BTL / SA Filing (same as above)', '£250+VAT', '£350+VAT'],
                      ['Total Fee for SA Filing when MTD comes to full force', '£550+VAT', '£850+VAT'],
                    ].map(([s, a, b], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 border border-gray-300">{s}</td>
                        <td className="px-2 py-1.5 border border-gray-300 text-right">{a}</td>
                        <td className="px-2 py-1.5 border border-gray-300 text-right">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Compliance &amp; Tax Registration Services</p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-gray-100"><th className="text-left px-2 py-1.5 border border-gray-300">Service</th><th className="text-right px-2 py-1.5 border border-gray-300">Companies House Charges</th><th className="text-right px-2 py-1.5 border border-gray-300">GNS Fee</th><th className="text-right px-2 py-1.5 border border-gray-300">VAT</th><th className="text-right px-2 py-1.5 border border-gray-300">Total</th></tr></thead>
                  <tbody className="text-gray-700">
                    {[
                      ['Company Registration', '£100.00', '£125.00', '£25.00', '£250.00'],
                      ['Company Registration — Same Day', '£156.00', '£200.00', '£40.00', '£396.00'],
                      ['Change of Name', '£20.00', '£75.00', '£15.00', '£110.00'],
                      ['Same Day Change of Name', '£85.00', '£150.00', '£30.00', '£265.00'],
                      ['Confirmation Statement Filing', '£50.00', '£50.00', '£10.00', '£110.00'],
                      ['Voluntary Strike Off DS01', '£14.00', '£100.00', '£20.00', '£134.00'],
                      ['Charge Registration', '£15.00', '£50.00', '£10.00', '£75.00'],
                      ['Certificate of Good Standing', '£15.00', '£50.00', '£10.00', '£75.00'],
                      ['Certificate of Good Standing — Express', '£50.00', '£75.00', '£15.00', '£140.00'],
                      ['Shareholding Changes', '—', '£50.00', '£10.00', '£60.00'],
                      ['Director Appointment / Termination', '—', '£50.00', '£10.00', '£60.00'],
                      ['Company / Directors’ Address Changes', '—', '£50.00', '£10.00', '£60.00'],
                      ['Companies House Identity Verification', '—', '£75.00', '£15.00', '£90.00'],
                      ['Reference Letters and Forms', '—', '£100.00', '£20.00', '£120.00'],
                      ['PAYE Registration', '—', '£100.00', '£20.00', '£120.00'],
                      ['VAT Registration', '—', '£75.00', '£15.00', '£90.00'],
                      ['Self-Assessment Registration', '—', '£100.00', '£20.00', '£120.00'],
                    ].map(([s, chf, gns, vat, tot], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 border border-gray-300">{s}</td>
                        <td className="px-2 py-1.5 border border-gray-300 text-right">{chf}</td>
                        <td className="px-2 py-1.5 border border-gray-300 text-right">{gns}</td>
                        <td className="px-2 py-1.5 border border-gray-300 text-right">{vat}</td>
                        <td className="px-2 py-1.5 border border-gray-300 text-right font-semibold">{tot}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Subscription Based Services</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-gray-100"><th className="text-left px-2 py-1.5 border border-gray-300">Service</th><th className="text-right px-2 py-1.5 border border-gray-300">Amount</th></tr></thead>
                  <tbody className="text-gray-700">
                    {[
                      ['Registered Office Address', '£20+VAT (Monthly)'],
                      ['QuickBooks Subscription', '£25+VAT (Monthly)'],
                    ].map(([s, a], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 border border-gray-300">{s}</td>
                        <td className="px-2 py-1.5 border border-gray-300 text-right">{a}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[10.5px] text-gray-400 border-t border-gray-200 pt-4 mt-8" style={{ fontFamily: 'Arial, sans-serif' }}>
              {firm.regStatement}
            </p>
          </div>
        </div>

        {/* ═══════════ ACCEPTANCE / SIGNING ═══════════ */}
        {!isExpired && (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Previous Accountant */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Previous Accountant Details</h2>
              <p className="text-sm text-gray-500 mb-5">We need these details to request professional clearance and your records on your behalf.</p>

              <label className="flex items-center gap-3 mb-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noPrevAccountant}
                  onChange={(e) => setNoPrevAccountant(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-sm text-gray-700">I do not have a previous accountant / this is a new business</span>
              </label>

              {!noPrevAccountant && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Previous Accountant Firm Name *</label>
                    <input
                      type="text"
                      value={prevFirmName}
                      onChange={(e) => setPrevFirmName(e.target.value)}
                      placeholder="e.g., Smith & Associates Ltd"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required={!noPrevAccountant}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Their Email Address *</label>
                    <input
                      type="email"
                      value={prevEmail}
                      onChange={(e) => setPrevEmail(e.target.value)}
                      placeholder="contact@previousfirm.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required={!noPrevAccountant}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Their Phone Number *</label>
                    <input
                      type="tel"
                      value={prevPhone}
                      onChange={(e) => setPrevPhone(e.target.value)}
                      placeholder="+44 20 1234 5678"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required={!noPrevAccountant}
                    />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    Once you sign, we will automatically contact your previous accountant requesting professional clearance and the handover of your accounting records.
                  </div>
                </div>
              )}
            </div>

            {/* Required Documents — split into Director (ID) and Company records */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setDocsExpanded(!docsExpanded)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="text-purple-600" size={22} />
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Required Documents</h2>
                    <p className="text-sm text-gray-500">Tell us the status of each — you don&apos;t need everything ready to sign.</p>
                  </div>
                </div>
                {docsExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </button>

              {docsExpanded && (
                <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-6">
                  {/* Director ID documents */}
                  <div>
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Your ID Documents (Director)</p>
                    <p className="text-xs text-gray-500 mb-3">Required for anti-money-laundering (KYC) checks. We&apos;ll follow up every 2 days for anything outstanding.</p>
                    <div className="space-y-3">
                      {DIRECTOR_DOCS.map((doc) => (
                        <div key={doc.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{doc.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                          </div>
                          <select
                            value={docStatus[doc.id] || 'later'}
                            onChange={(e) => setDocStatus((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                            className="flex-shrink-0 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                          >
                            {DOC_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Company / accounting records */}
                  <div>
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Company &amp; Accounting Records</p>
                    <p className="text-xs text-gray-500 mb-3">Where these sit with your previous accountant, we&apos;ll request them directly as part of professional clearance.</p>
                    <div className="space-y-3">
                      {COMPANY_DOCS.map((doc) => (
                        <div key={doc.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{doc.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                          </div>
                          <select
                            value={docStatus[doc.id] || 'later'}
                            onChange={(e) => setDocStatus((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                            className="flex-shrink-0 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          >
                            {DOC_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Declaration + Signature */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="text-purple-600" size={22} />
                <h2 className="text-lg font-bold text-gray-900">Client Declaration &amp; Signature</h2>
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

              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <input
                  type="checkbox"
                  checked={authorised}
                  onChange={(e) => setAuthorised(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-400 text-purple-600 mt-0.5"
                />
                <div>
                  <p className="font-bold text-gray-900">
                    I have read and understood the contract in its entirety and authorise {firm.name} to take over all my accountancy work
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    By checking this box I accept the terms on behalf of {link.companyName}.
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

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                canSubmit
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-xl hover:scale-[1.01]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Signing...' : 'Sign & Accept Engagement'}
            </button>

            {!canSubmit && !isExpired && (
              <p className="text-center text-sm text-gray-500">
                {!authorised && 'Please check the declaration above to proceed. '}
                {authorised && signatureName.trim().length <= 1 && 'Please type your full name in the signature box. '}
                {authorised && !noPrevAccountant && (!prevFirmName || !prevEmail || !prevPhone) && 'Please fill in your previous accountant details or confirm you have none.'}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
