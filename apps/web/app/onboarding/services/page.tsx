'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const SERVICES = [
  { id: 'bookkeeping', name: 'Bookkeeping', basePrice: 150, description: 'Monthly transaction entry and reconciliation' },
  { id: 'vat', name: 'VAT Returns', basePrice: 200, description: 'Quarterly/monthly VAT return filing' },
  { id: 'paye', name: 'PAYE & NIC', basePrice: 250, description: 'Payroll and HMRC compliance' },
  { id: 'accounts', name: 'Annual Accounts', basePrice: 500, description: 'Year-end statutory accounts & audit' },
  { id: 'tax', name: 'Tax Planning', basePrice: 300, description: 'Strategic tax advice and optimization' },
  { id: 'cis', name: 'CIS Compliance', basePrice: 180, description: 'Construction Industry Scheme support' },
];

function ServicesPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firm = searchParams.get('firm') || 'gns';

  const [selected, setSelected] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(SERVICES.map((s) => [s.id, s.basePrice]))
  );
  const [companyNumber, setCompanyNumber] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleService = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const updatePrice = (id: string, value: string) => {
    const num = parseInt(value) || 0;
    setPrices((prev) => ({ ...prev, [id]: Math.max(0, num) }));
  };

  const total = selected.reduce((sum, id) => sum + (prices[id] || 0), 0);

  const handleContinue = async () => {
    if (selected.length === 0 || !companyNumber || !directorEmail) return;
    setLoading(true);
    const selectedServices = selected.map((id) => ({
      id,
      name: SERVICES.find((s) => s.id === id)?.name || id,
      price: prices[id] || 0,
    }));
    setTimeout(() => {
      router.push(
        `/onboarding/company?firm=${firm}&services=${selected.join(',')}&prices=${encodeURIComponent(JSON.stringify(prices))}&serviceDetails=${encodeURIComponent(JSON.stringify(selectedServices))}&companyNumber=${companyNumber}&directorEmail=${encodeURIComponent(directorEmail)}`
      );
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-purple-600 font-semibold">Step 2</span>
            <span>Services & Company</span>
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

        {/* Company Number + Director Email */}
        <div className="mb-10 p-6 bg-purple-50 border border-purple-200 rounded-xl space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Company Registration Number *
            </label>
            <input
              type="text"
              placeholder="e.g., 12345678"
              value={companyNumber}
              onChange={(e) => setCompanyNumber(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              maxLength={8}
            />
            <p className="text-xs text-gray-500 mt-1">
              We'll verify this with Companies House automatically
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Primary Director Email *
            </label>
            <input
              type="email"
              placeholder="director@company.com"
              value={directorEmail}
              onChange={(e) => setDirectorEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              The engagement letter will be sent to this email address
            </p>
          </div>
        </div>

        {/* Services grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {SERVICES.map((service) => (
            <button
              key={service.id}
              onClick={() => toggleService(service.id)}
              className={`p-6 rounded-xl border-2 transition-all text-left group ${
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

              {/* Price input - only show if selected */}
              {selected.includes(service.id) && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm text-gray-600">£</span>
                  <input
                    type="number"
                    value={prices[service.id]}
                    onChange={(e) => updatePrice(service.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-20 px-3 py-2 border border-purple-300 rounded text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="0"
                  />
                  <span className="text-sm text-gray-600">/month</span>
                </div>
              )}

              {/* Default price - show if not selected */}
              {!selected.includes(service.id) && (
                <div className="mt-3 text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">£{service.basePrice}</span>
                  <span className="text-gray-500">/month</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Price summary */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Selected Services</p>
              <p className="text-2xl font-bold text-gray-900">
                £{total}
                <span className="text-lg text-gray-500 ml-1">/month</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {selected.length} service{selected.length !== 1 ? 's' : ''} selected
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-2">Annual saving</p>
              <p className="text-2xl font-bold text-purple-600">
                £{Math.round(total * 12 * 0.1)}
              </p>
              <p className="text-xs text-purple-600">with annual plan</p>
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
            disabled={selected.length === 0 || !companyNumber || !directorEmail || loading}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
              selected.length === 0 || !companyNumber || !directorEmail
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
