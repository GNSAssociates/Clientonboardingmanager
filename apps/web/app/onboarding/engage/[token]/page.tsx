'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { AlertCircle, Clock, CheckCircle2, FileText, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { getFirm } from '@/lib/firms';

const REQUIRED_DOCS = [
  { id: 'photo_id', label: 'Photo ID', description: 'Passport or driving licence' },
  { id: 'proof_address', label: 'Proof of Address', description: 'Utility bill or bank statement (less than 3 months old)' },
  { id: 'companies_house', label: 'Companies House documents', description: 'Certificate of incorporation and latest confirmation statement' },
  { id: 'hmrc_utr', label: 'HMRC UTR Number', description: 'Your Unique Taxpayer Reference' },
  { id: 'vat_reg', label: 'VAT Registration Certificate', description: 'If VAT registered' },
  { id: 'prev_accounts', label: 'Previous Accounts', description: 'Last 2 years statutory accounts if available' },
  { id: 'bank_details', label: 'Bank Account Details', description: 'Business bank account information' },
  { id: 'payroll_records', label: 'Payroll Records', description: 'If you have employees — payroll history' },
  { id: 'software_access', label: 'Accounting Software Access', description: 'Login credentials for Xero, QuickBooks, Sage etc.' },
];

interface OnboardingLinkData {
  id: string;
  companyName: string;
  companyNumber: string;
  clientEmail: string;
  directorName: string;
  firmSlug: string;
  services: Array<{ id: string; name: string; price: number }>;
  expiresAt: string;
  status: string;
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

  // Previous accountant fields
  const [prevFirmName, setPrevFirmName] = useState('');
  const [prevEmail, setPrevEmail] = useState('');
  const [prevPhone, setPrevPhone] = useState('');
  const [noPrevAccountant, setNoPrevAccountant] = useState(false);

  // Required docs acknowledgement
  const [docsChecked, setDocsChecked] = useState<Record<string, boolean>>({});

  // Declaration
  const [authorised, setAuthorised] = useState(false);

  // Sections open/closed
  const [docsExpanded, setDocsExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/onboarding/links/${token}`)
      .then((r) => r.json())
      .then((data) => setLink(data))
      .catch(() => setPageError('Link not found or invalid'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading your engagement letter...</p>
      </div>
    </div>
  );

  if (pageError || !link) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100 px-4">
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
  const totalMonthly = (link.services || []).reduce((s, sv) => s + sv.price, 0);
  const allDocsChecked = REQUIRED_DOCS.every((d) => docsChecked[d.id]);

  const canSubmit = authorised && (noPrevAccountant || (prevFirmName && prevEmail && prevPhone)) && !isExpired;

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
          docsAcknowledged: Object.keys(docsChecked).filter((k) => docsChecked[k]),
          authorised: true,
        }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100 px-4">
      <div className="max-w-xl w-full bg-white rounded-2xl p-10 shadow-lg text-center">
        <div className="inline-flex mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-40" />
            <CheckCircle2 className="text-green-500 relative" size={72} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Engagement Accepted!</h1>
        <p className="text-gray-600 mb-6">
          Thank you, <strong>{link.directorName}</strong>. Your engagement with <strong>{firm.name}</strong> has been confirmed.
        </p>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-left space-y-2 mb-6">
          <p className="text-sm text-gray-700">✅ Confirmation email sent to <strong>{link.clientEmail}</strong></p>
          {!noPrevAccountant && prevEmail && (
            <p className="text-sm text-gray-700">✅ Records request sent to <strong>{prevEmail}</strong></p>
          )}
          <p className="text-sm text-gray-700">✅ {firm.name} has been notified</p>
        </div>
        <p className="text-sm text-gray-500">A member of our team will be in touch within 2 business days.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100 py-12 px-4">
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

        {/* Firm letterhead */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Coloured stripe using firm's accent colour */}
          <div className="h-2" style={{ background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }} />
          <div className="p-8 border-b border-gray-100">
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-5">
                {/* Logo */}
                <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
                  <Image
                    src={firm.logo}
                    alt={firm.name}
                    width={80}
                    height={80}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{firm.legalName}</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{firm.address}</p>
                  <p className="text-sm text-gray-500">{firm.city}, {firm.postcode}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{firm.phone} · {firm.email}</p>
                </div>
              </div>
              <div className="text-right text-sm text-gray-500 flex-shrink-0">
                <p className="font-medium">{today}</p>
                <p className="mt-1 font-mono text-xs text-gray-400">Ref: {token.substring(0, 8).toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Letter body */}
          <div className="p-8 space-y-5 text-gray-700 leading-relaxed">
            <p>Dear <strong>{link.directorName || 'Director'}</strong>,</p>

            <p>
              We are pleased to confirm that <strong>{firm.name}</strong> has been engaged to provide professional accountancy and advisory services to <strong>{link.companyName}</strong> (Company No. {link.companyNumber}).
            </p>

            <p>
              This letter sets out the terms and conditions upon which we will provide our services. Please read it carefully before accepting.
            </p>

            {link.services && link.services.length > 0 && (
              <div>
                <p className="font-semibold text-gray-900 mb-3">Agreed Services & Monthly Fees:</p>
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-purple-50">
                      <th className="text-left px-4 py-2 text-gray-700">Service</th>
                      <th className="text-right px-4 py-2 text-gray-700">Monthly Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {link.services.map((s, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-4 py-2">{s.name}</td>
                        <td className="px-4 py-2 text-right font-semibold">£{s.price}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-purple-200 bg-purple-50">
                      <td className="px-4 py-2 font-bold text-gray-900">Total Monthly</td>
                      <td className="px-4 py-2 text-right font-bold text-purple-700">£{totalMonthly}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-2">Note: 20% VAT applies to all fees above. Fees are collected monthly by GoCardless Direct Debit.</p>
              </div>
            )}

            {/* Scope of Services */}
            <div>
              <p className="font-semibold text-gray-900 mb-3">Scope of Services & Coverage:</p>
              <p className="text-xs text-gray-500 mb-2">Services not covered within the scope below are charged as per our Schedule of Service Charges (SSC) in Annex A.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      <th className="text-left px-3 py-2 border-b border-gray-200 w-1/3">Scope of Services</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200 w-1/3">Coverage Threshold (What is included?)</th>
                      <th className="text-left px-3 py-2 border-b border-gray-200">Fee Exceeding Scope</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {[
                      ['Annual Accounts & Corporation Tax', 'Yearly Turnover ≤ £200,000', 'To be agreed later'],
                      ['Bookkeeping & Quarterly VAT Returns Filing', 'Turnover: As Above · Volume: 300 transactions per quarter (Bank Statement Lines + Purchase Bills + Sales Invoices)', '£0.95 per transaction'],
                      ['PAYE & Pension', '2 persons including directors', 'One off Setup: £10+VAT per staff · Ongoing: £10+VAT per staff per pay run'],
                      ['CIS', 'N/A', '£10+VAT per subcontractor per month'],
                      ['Self-Assessment (Excluding: Buy-to-Let)', '2 persons including directors', '£200+VAT per year for additional person · Rental Property: To be Agreed Later'],
                      ['Confirmation Statement Filing to Companies House', 'Once a Year', '£50+VAT for additional filing'],
                      ['References and Letters', '1 Letter or 1 Reference Included', '£75+VAT for additional reference / letter'],
                    ].map(([service, threshold, excess], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border-b border-gray-100 font-medium">{service}</td>
                        <td className="px-3 py-2 border-b border-gray-100">{threshold}</td>
                        <td className="px-3 py-2 border-b border-gray-100">{excess}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-2">Terms of Engagement:</p>
              <ul className="list-disc list-inside space-y-1.5 text-sm">
                <li>This letter is effective from the date signed and supersedes any previous engagement letter</li>
                <li>Fees are invoiced monthly in advance by GoCardless Direct Debit and are subject to annual review</li>
                <li>We are regulated by <strong>{firm.regBody}</strong> and bound by their ethical guidelines</li>
                <li>All information you provide will be treated in the strictest confidence in accordance with GDPR and the Data Protection Act 2018</li>
                <li>We will contact your previous accountant to arrange a professional handover of your records</li>
                <li>Either party may vary or terminate this authority with 30 days' written notice</li>
                <li>Our liability is limited to the fees paid in the 12 months preceding any claim</li>
                <li>Work outside the agreed scope will require a separate letter of engagement if the value exceeds £200</li>
                <li>This engagement is governed by the laws of England and Wales</li>
              </ul>
            </div>

            {/* Annex A: Schedule of Service Charges */}
            <div className="border-t border-gray-200 pt-5">
              <p className="font-bold text-gray-900 mb-1">Annex A: Schedule of Service Charges (SSC)</p>
              <p className="text-xs text-gray-500 mb-3">Ad-hoc and specialist services not included in your monthly fee are charged as follows:</p>

              <p className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Self-Assessment Tax Return</p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                  <thead><tr className="bg-gray-50"><th className="text-left px-2 py-1.5 border-b border-gray-200">Service</th><th className="text-right px-2 py-1.5 border-b border-gray-200">Single</th><th className="text-right px-2 py-1.5 border-b border-gray-200">Couple</th></tr></thead>
                  <tbody className="text-gray-700">
                    {[
                      ['Buy to Let SA Filing', '£250+VAT', '£350+VAT'],
                      ['Director and other SA (Salary, Dividend)', '£200+VAT', '£375+VAT'],
                      ['Sole Trader (GNS doing bookkeeping)', '£350+VAT', 'N/A'],
                      ['Change of Beneficial Ownership (Rental)', '£500+VAT (New) / £400+VAT (Existing)', ''],
                      ['MTD SA — Quarterly', '£75+VAT/quarter', '£150+VAT/quarter'],
                      ['MTD SA — Annual Summary Filing', 'Free', 'Free'],
                      ['Total SA Fee when MTD in full force', '£550+VAT', '£850+VAT'],
                    ].map(([s, a, b], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 border-b border-gray-100">{s}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right">{a}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Compliance & Tax Registration Services</p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                  <thead><tr className="bg-gray-50"><th className="text-left px-2 py-1.5 border-b border-gray-200">Service</th><th className="text-right px-2 py-1.5 border-b border-gray-200">CH Fee</th><th className="text-right px-2 py-1.5 border-b border-gray-200">GNS Fee</th><th className="text-right px-2 py-1.5 border-b border-gray-200">VAT</th><th className="text-right px-2 py-1.5 border-b border-gray-200">Total</th></tr></thead>
                  <tbody className="text-gray-700">
                    {[
                      ['Company Registration', '£100', '£125', '£25', '£250'],
                      ['Company Registration — Same Day', '£156', '£200', '£40', '£396'],
                      ['Change of Name', '£20', '£75', '£15', '£110'],
                      ['Same Day Change of Name', '£85', '£150', '£30', '£265'],
                      ['Confirmation Statement Filing', '£50', '£50', '£10', '£110'],
                      ['Voluntary Strike Off DS01', '£14', '£100', '£20', '£134'],
                      ['Charge Registration', '£15', '£50', '£10', '£75'],
                      ['Certificate of Good Standing', '£15', '£50', '£10', '£75'],
                      ['Certificate of Good Standing — Express', '£50', '£75', '£15', '£140'],
                      ['Shareholding Changes', '—', '£50', '£10', '£60'],
                      ['Director Appointment / Termination', '—', '£50', '£10', '£60'],
                      ['Company / Directors Address Changes', '—', '£50', '£10', '£60'],
                      ['Companies House Identity Verification', '—', '£75', '£15', '£90'],
                      ['Reference Letters and Forms', '—', '£100', '£20', '£120'],
                      ['PAYE Registration', '—', '£100', '£20', '£120'],
                      ['VAT Registration', '—', '£75', '£15', '£90'],
                      ['Self-Assessment Registration', '—', '£100', '£20', '£120'],
                    ].map(([s, ch, gns, vat, tot], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 border-b border-gray-100">{s}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right">{ch}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right">{gns}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right">{vat}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right font-semibold">{tot}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Subscription Based Services</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                  <thead><tr className="bg-gray-50"><th className="text-left px-2 py-1.5 border-b border-gray-200">Service</th><th className="text-right px-2 py-1.5 border-b border-gray-200">Amount</th></tr></thead>
                  <tbody className="text-gray-700">
                    {[
                      ['Registered Office Address', '£20+VAT (Monthly)'],
                      ['QuickBooks Subscription', '£25+VAT (Monthly)'],
                    ].map(([s, a], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 border-b border-gray-100">{s}</td>
                        <td className="px-2 py-1.5 border-b border-gray-100 text-right">{a}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p>
              We look forward to working with you and are committed to providing the highest standard of professional service. If you have any questions about any aspect of this letter, please do not hesitate to contact us before signing.
            </p>

            <p className="mt-4">
              Yours sincerely,<br />
              <span className="font-semibold">{firm.legalName}</span><br />
              <span className="text-sm text-gray-500">{firm.email} · {firm.website}</span>
            </p>

            <p className="text-xs text-gray-400 border-t border-gray-100 pt-4 mt-6">
              {firm.regStatement}
            </p>
          </div>
        </div>

        {!isExpired && (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Previous Accountant */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Previous Accountant Details</h2>
              <p className="text-sm text-gray-500 mb-5">We need these details to request your records on your behalf.</p>

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
                    Once you accept, we will automatically contact your previous accountant requesting the professional handover of your accounting records.
                  </div>
                </div>
              )}
            </div>

            {/* Required Documents */}
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
                    <p className="text-sm text-gray-500">Please acknowledge the documents we will need from you</p>
                  </div>
                </div>
                {docsExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </button>

              {docsExpanded && (
                <div className="px-6 pb-6 space-y-3 border-t border-gray-100 pt-4">
                  {REQUIRED_DOCS.map((doc) => (
                    <label key={doc.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={docsChecked[doc.id] || false}
                        onChange={(e) => setDocsChecked((prev) => ({ ...prev, [doc.id]: e.target.checked }))}
                        className="w-4 h-4 rounded text-purple-600 mt-0.5"
                      />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{doc.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Declaration */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="text-purple-600" size={22} />
                <h2 className="text-lg font-bold text-gray-900">Client Declaration</h2>
              </div>

              <div className="bg-white rounded-xl p-5 mb-5 border border-purple-200">
                <p className="text-gray-800 leading-relaxed text-sm">
                  I, <strong>{link.directorName || 'the undersigned'}</strong>, being a Director of <strong>{link.companyName}</strong> (Company No. {link.companyNumber}), hereby authorise <strong>{firm.name}</strong> to act as my company's accountants and to take over all accountancy work with effect from the date of this agreement. I confirm that I have read and agree to the terms of engagement set out in this letter.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={authorised}
                  onChange={(e) => setAuthorised(e.target.checked)}
                  className="w-5 h-5 rounded border-purple-400 text-purple-600 mt-0.5"
                />
                <div>
                  <p className="font-bold text-gray-900">
                    I hereby authorise {firm.name} to take over all my accountancy work
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    By checking this box I confirm I have read the engagement letter above and accept the terms on behalf of {link.companyName}.
                  </p>
                </div>
              </label>
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
              {submitting ? 'Submitting...' : 'Accept & Authorise Engagement'}
            </button>

            {!canSubmit && !isExpired && (
              <p className="text-center text-sm text-gray-500">
                {!authorised && 'Please check the declaration above to proceed.'}
                {authorised && !noPrevAccountant && (!prevFirmName || !prevEmail || !prevPhone) && 'Please fill in your previous accountant details or confirm you have none.'}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
