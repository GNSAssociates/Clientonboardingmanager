'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

const FIRM_INFO: Record<string, { name: string; address: string; phone: string }> = {
  gns: { name: 'GNS Associates', address: '123 Business St, London', phone: '+44 20 1234 5678' },
  llp: { name: 'GNS Associates LLP', address: '456 Partnership Ave, London', phone: '+44 20 2345 6789' },
  galaxy: { name: 'Galaxy (GXY)', address: '789 Tech Hub, London', phone: '+44 20 3456 7890' },
};

export default function AuthorizationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firm = searchParams.get('firm') || 'gns';
  const company = searchParams.get('company') || 'XXXXXXXX';
  const services = searchParams.get('services') || '';

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const firmData = FIRM_INFO[firm] || FIRM_INFO.gns;

  const handleAccept = async () => {
    if (!accepted) return;
    setLoading(true);

    // Simulate creating lead/case
    try {
      // In production this would call the API to create a lead
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Redirect to success page
      router.push(
        `/onboarding/success?firm=${firm}&company=${company}&services=${services}`
      );
    } catch (err) {
      console.error('Failed to submit:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-purple-600 font-semibold">Step 4</span>
            <span>Authorization</span>
          </div>
          <div className="mt-2 h-1 bg-gray-200 rounded-full">
            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full w-5/6" />
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Authorization Letter
          </h1>
          <p className="text-gray-600">
            Please review and accept our engagement letter to proceed with onboarding.
          </p>
        </div>

        {/* Letter */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
          {/* Letterhead */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-8 text-white">
            <h2 className="text-2xl font-bold">{firmData.name}</h2>
            <p className="text-purple-100 mt-1">{firmData.address}</p>
            <p className="text-purple-100">{firmData.phone}</p>
          </div>

          {/* Letter Content */}
          <div className="p-8 space-y-6 text-gray-700 leading-relaxed">
            <div>
              <p className="text-sm text-gray-500">
                Date: {new Date().toLocaleDateString('en-GB', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <div>
              <p className="font-semibold text-gray-900">RE: Engagement Letter & Terms of Engagement</p>
            </div>

            <div className="space-y-4">
              <p>
                Dear Sir/Madam,
              </p>

              <p>
                We are pleased to offer our services as your accountants and bookkeepers. This letter confirms the terms and conditions on which {firmData.name} will provide accounting, tax, and business advisory services to your company (Company Number: {company}).
              </p>

              <p>
                <strong>Services to be provided:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                {services.split(',').filter(Boolean).map((service) => (
                  <li key={service} className="capitalize">
                    {service.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>

              <p>
                <strong>Key Terms:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Our fees are based on the selected services and will be invoiced monthly</li>
                <li>We are regulated by the Institute of Chartered Accountants in England and Wales (ICAEW)</li>
                <li>All information provided will be treated in strict confidence</li>
                <li>We will seek your previous accountant's permission to obtain your records</li>
                <li>Our engagement may be terminated by either party with 30 days' written notice</li>
              </ul>

              <p>
                We are committed to providing high-quality professional services. If you have any questions or require clarification on any of the above, please do not hesitate to contact us.
              </p>

              <p>
                We look forward to working with you.
              </p>

              <p>
                Yours faithfully,
              </p>

              <div className="pt-8">
                <p className="font-semibold text-gray-900">{firmData.name}</p>
                <p className="text-gray-600">Engagement Services Team</p>
              </div>
            </div>
          </div>
        </div>

        {/* Acceptance checkbox */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-8">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex-shrink-0 mt-1">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                I accept the terms of engagement
              </p>
              <p className="text-sm text-gray-600 mt-1">
                I confirm that I have read and understood the engagement letter above and agree to proceed with onboarding on these terms.
              </p>
            </div>
          </label>
        </div>

        {/* Success message */}
        {accepted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex items-start gap-3">
            <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-green-900">Ready to proceed</p>
              <p className="text-sm text-green-700 mt-1">
                Your onboarding will begin immediately upon acceptance.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 text-gray-700 hover:text-gray-900 font-semibold"
          >
            <ChevronLeft size={20} />
            Back
          </button>

          <button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
              accepted
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Processing...' : 'Accept & Proceed'}
            {!loading && <ChevronRight size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
