'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CompanyData {
  companyNumber: string;
  companyName: string;
  address: string;
  directors: Array<{ name: string; email?: string }>;
  verified: boolean;
}

export default function CompanyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firm = searchParams.get('firm') || 'gns';
  const services = searchParams.get('services') || '';

  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [companyNumber, setCompanyNumber] = useState('');
  const [email, setEmail] = useState('');
  const [prevAccountantName, setPrevAccountantName] = useState('');
  const [prevAccountantEmail, setPrevAccountantEmail] = useState('');
  const [prevAccountantPhone, setPrevAccountantPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState<CompanyData | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (companyNumber.length < 8) {
        throw new Error('Company number must be at least 8 characters');
      }

      // Call Companies House API via our backend
      const res = await fetch(`/api/companies-house/${companyNumber}`);

      if (res.status === 404) {
        setError('Company not found on Companies House. You can enter details manually.');
        // In a real scenario, we'd offer a manual entry fallback
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to lookup company details');
      }

      const data = await res.json();
      setCompany({
        companyNumber: data.number,
        companyName: data.name,
        address: data.address,
        directors: data.officers || [],
        verified: true,
      });

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lookup company');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!company || !email) return;

    setLoading(true);
    setError('');

    try {
      // Generate onboarding link
      const res = await fetch('/api/onboarding/links/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: firm,
          companyName: company.companyName,
          companyNumber: company.companyNumber,
          clientEmail: email,
          prevAccountantName,
          prevAccountantEmail,
          prevAccountantPhone,
          services: services.split(',').filter(Boolean),
          prices: JSON.parse(searchParams.get('prices') || '{}'),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate engagement link');
      }

      const result = await res.json();

      // Navigate to success page
      router.push(
        `/onboarding/success?firm=${firm}&company=${company.companyName}&email=${email}&token=${result.token}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-purple-600 font-semibold">Step 3</span>
            <span>Verify Company</span>
          </div>
          <div className="mt-2 h-1 bg-gray-200 rounded-full">
            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full w-2/3" />
          </div>
        </div>

        {step === 'input' ? (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Company Verification
              </h1>
              <p className="text-gray-600">
                We'll look up your company details from Companies House to get started.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLookup} className="space-y-6">
              {/* Company Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Company Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g., 12345678"
                  value={companyNumber}
                  onChange={(e) => setCompanyNumber(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Find this on your Companies House certificate
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Email Address *
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Previous Accountant */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Previous Accountant (optional)
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      placeholder="Previous firm name"
                      value={prevAccountantName}
                      onChange={(e) => setPrevAccountantName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="contact@prevfirm.com"
                      value={prevAccountantEmail}
                      onChange={(e) => setPrevAccountantEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="+44 123 456 7890"
                      value={prevAccountantPhone}
                      onChange={(e) => setPrevAccountantPhone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between gap-4 pt-4">
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
                  disabled={loading || !companyNumber || !email}
                  className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
                    loading || !companyNumber || !email
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Company
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            {/* Company Preview */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Verify Information
              </h1>
              <p className="text-gray-600">
                Please confirm these details before proceeding.
              </p>
            </div>

            {company && (
              <div className="space-y-6">
                {/* Company Card */}
                <div className="bg-gradient-to-r from-green-50 to-white border border-green-200 rounded-xl p-8">
                  <div className="flex items-start gap-3 mb-6">
                    <CheckCircle2 className="text-green-600 flex-shrink-0 mt-1" size={24} />
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {company.companyName}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {company.verified ? 'Verified via Companies House' : 'Manually entered'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Company Number</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {company.companyNumber}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Registered Address</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {company.address}
                      </p>
                    </div>

                    {company.directors.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Directors</p>
                        <ul className="space-y-1">
                          {company.directors.map((director, i) => (
                            <li key={i} className="text-gray-900 font-medium">
                              • {typeof director === 'string' ? director : director.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email confirmation */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Engagement Link</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    We'll send your onboarding engagement link to:
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                    <p className="font-semibold text-gray-900">{email}</p>
                  </div>
                  {(prevAccountantName || prevAccountantEmail) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                      <p className="text-sm text-blue-900">
                        ✓ We'll also contact <strong>{prevAccountantName}</strong> to request your accounting records.
                      </p>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-4 pt-4">
                  <button
                    onClick={() => {
                      setStep('input');
                      setCompany(null);
                    }}
                    className="flex items-center gap-2 px-6 py-3 text-gray-700 hover:text-gray-900 font-semibold"
                  >
                    <ChevronLeft size={20} />
                    Edit Details
                  </button>

                  <button
                    onClick={handleContinue}
                    disabled={loading}
                    className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
                      loading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader className="animate-spin" size={20} />
                        Generating Link...
                      </>
                    ) : (
                      <>
                        Generate & Send Link
                        <ChevronRight size={20} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
