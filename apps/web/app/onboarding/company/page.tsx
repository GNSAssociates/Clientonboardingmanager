'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface CompanyData {
  companyNumber: string;
  companyName: string;
  address: string;
  directors: string[];
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
      // Mock Companies House lookup - in production this would call the real API
      // For now we'll simulate with placeholder data
      if (companyNumber.length < 8) {
        throw new Error('Company number must be at least 8 characters');
      }

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock company data
      setCompany({
        companyNumber,
        companyName: `Example Ltd (${companyNumber})`,
        address: '123 Business Park, London, SW1A 1AA, United Kingdom',
        directors: ['John Smith', 'Sarah Johnson'],
      });

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lookup company');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.push(
      `/onboarding/authorization?firm=${firm}&services=${services}&company=${companyNumber}`
    );
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
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {company.companyName}
                  </h2>

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

                    <div>
                      <p className="text-sm text-gray-600 mb-2">Directors</p>
                      <ul className="space-y-1">
                        {company.directors.map((director, i) => (
                          <li key={i} className="text-gray-900 font-medium">
                            • {director}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Confirmation */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-900">
                    ✓ Company verified via Companies House. We'll contact your previous accountant
                    to request your accounting records.
                  </p>
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
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg"
                  >
                    Continue to Authorization
                    <ChevronRight size={20} />
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
