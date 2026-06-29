'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';
import { getFirm } from '@/lib/firms';

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
}

function CompanyPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const firmSlug = searchParams.get('firm') || 'gns';
  const companyNumberParam = searchParams.get('companyNumber') || '';
  const directorEmailParam = searchParams.get('directorEmail') || '';
  const serviceDetailsParam = searchParams.get('serviceDetails') || '[]';

  const firm = getFirm(firmSlug);

  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [companyNumber, setCompanyNumber] = useState(companyNumberParam);
  const [directorEmail, setDirectorEmail] = useState(directorEmailParam);
  const [selectedDirector, setSelectedDirector] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState<CompanyData | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (companyNumber.trim().length < 7) {
        throw new Error('Company number must be at least 7 characters');
      }

      const res = await fetch(`/api/companies-house/${companyNumber.trim()}`);

      if (res.status === 404) {
        setError('Company not found on Companies House. Please check the number and try again.');
        return;
      }
      if (!res.ok) throw new Error('Failed to lookup company details');

      const data = await res.json();
      const directors: Director[] = (data.officers || []).map((o: string | { name: string; email?: string }) =>
        typeof o === 'string' ? { name: o } : o
      );

      setCompany({
        number: data.number,
        name: data.name,
        address: data.address,
        status: data.status,
        directors,
      });

      if (directors.length > 0) setSelectedDirector(directors[0]?.name ?? '');
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lookup company');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!company || !directorEmail) return;
    setLoading(true);
    setError('');

    try {
      let serviceDetails: Array<{ id: string; name: string; price: number }> = [];
      try { serviceDetails = JSON.parse(decodeURIComponent(serviceDetailsParam)); } catch {}

      const res = await fetch('/api/onboarding/links/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmSlug,
          companyName: company.name,
          companyNumber: company.number,
          companyAddress: company.address,
          directorName: selectedDirector || company.directors[0]?.name || '',
          directorEmail,
          serviceDetails,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate engagement link');
      const result = await res.json();

      router.push(
        `/onboarding/success?firm=${firmSlug}&company=${encodeURIComponent(company.name)}&email=${encodeURIComponent(directorEmail)}&token=${result.token}`
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
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <span className="font-semibold" style={{ color: firm.accentColor }}>Step 3 of 4</span>
            <span>— Company Verification</span>
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

        {step === 'input' ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Company</h1>
              <p className="text-gray-600">We'll look up the company details from Companies House automatically.</p>
            </div>

            <form onSubmit={handleLookup} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Company Number *
                </label>
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
                <p className="text-xs text-gray-500 mt-1">Found on your Companies House certificate or at beta.companieshouse.gov.uk</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Primary Director Email Address *
                </label>
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
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-red-700">{error}</p>
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
                  {loading ? (
                    <><Loader2 size={20} className="animate-spin" /> Looking up...</>
                  ) : (
                    <>Verify Company <ChevronRight size={20} /></>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : company && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Confirm Details</h1>
              <p className="text-gray-600">Please verify these details before sending the engagement link.</p>
            </div>

            <div className="space-y-5">
              {/* Company verified card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start gap-3 mb-5">
                  <CheckCircle2 className="text-green-500 flex-shrink-0 mt-0.5" size={22} />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
                    <p className="text-sm text-green-700 font-medium">Verified via Companies House</p>
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
                </div>

                {/* Director selection */}
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
                              selectedDirector === d.name
                                ? 'border-purple-400 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
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

              {/* Where we're sending it */}
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                <p className="text-sm text-purple-900 font-semibold mb-2">Engagement letter will be sent to:</p>
                <p className="font-bold text-gray-900 text-lg">{directorEmail}</p>
                <p className="text-xs text-purple-700 mt-2">
                  The client will receive a 30-day link to read and sign the engagement letter online.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="text-red-500 flex-shrink-0" size={16} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-2">
                <button
                  onClick={() => { setStep('input'); setCompany(null); setError(''); }}
                  className="flex items-center gap-2 px-6 py-3 text-gray-700 hover:text-gray-900 font-semibold"
                >
                  <ChevronLeft size={20} />
                  Edit Details
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
                    loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'text-white hover:shadow-xl hover:scale-[1.02]'
                  }`}
                  style={loading ? {} : { background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }}
                >
                  {loading ? (
                    <><Loader2 size={20} className="animate-spin" /> Generating...</>
                  ) : (
                    <>Generate & Send Link <ChevronRight size={20} /></>
                  )}
                </button>
              </div>
            </div>
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
