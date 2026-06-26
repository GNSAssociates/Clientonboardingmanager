'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, Mail } from 'lucide-react';

const FIRM_INFO: Record<string, { name: string; address: string; phone: string }> = {
  gns: { name: 'GNS Associates', address: '123 Business St, London', phone: '+44 20 1234 5678' },
  llp: { name: 'GNS Associates LLP', address: '456 Partnership Ave, London', phone: '+44 20 2345 6789' },
  galaxy: { name: 'Galaxy (GXY)', address: '789 Tech Hub, London', phone: '+44 20 3456 7890' },
};

interface OnboardingLink {
  id: string;
  companyName: string;
  clientEmail: string;
  expiresAt: string;
  createdAt: string;
  status: 'sent' | 'accepted' | 'expired';
}

export default function EngagementPage() {
  const params = useParams();
  const token = params.token as string;

  const [link, setLink] = useState<OnboardingLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [prevAccountantName, setPrevAccountantName] = useState('');
  const [prevAccountantEmail, setPrevAccountantEmail] = useState('');
  const [prevAccountantPhone, setPrevAccountantPhone] = useState('');

  useEffect(() => {
    // Fetch link details
    const fetchLink = async () => {
      try {
        const res = await fetch(`/api/onboarding/links/${token}`);
        if (!res.ok) throw new Error('Link not found or invalid');
        const data = await res.json();
        setLink(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load engagement');
      } finally {
        setLoading(false);
      }
    };
    fetchLink();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading engagement...</p>
        </div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100 px-4">
        <div className="max-w-2xl w-full bg-white rounded-xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="text-red-600" size={32} />
            <h1 className="text-2xl font-bold text-gray-900">Invalid or Expired Link</h1>
          </div>
          <p className="text-gray-600 mb-6">
            {error || 'This onboarding link is no longer valid. Please contact GNS Associates to request a new one.'}
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  const expiresAt = new Date(link.expiresAt);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysUntilExpiry <= 0;
  const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 7;

  const firmData = FIRM_INFO['gns']; // Default to GNS, would be parameterized

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted || !prevAccountantName || !prevAccountantEmail || !prevAccountantPhone) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/onboarding/links/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prevAccountantName,
          prevAccountantEmail,
          prevAccountantPhone,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit engagement');

      // Success - show confirmation
      const result = await res.json();
      window.location.href = `/onboarding/success?token=${token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Expiry warning */}
        {isExpired && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 rounded flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-900">This link has expired</p>
              <p className="text-sm text-red-700 mt-1">
                The onboarding link expired on {expiresAt.toLocaleDateString('en-GB')}. Please contact GNS Associates to request a new link.
              </p>
            </div>
          </div>
        )}

        {isExpiringSoon && !isExpired && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-600 rounded flex items-start gap-3">
            <Clock className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-yellow-900">Link expires in {daysUntilExpiry} days</p>
              <p className="text-sm text-yellow-700 mt-1">
                Please complete this engagement before {expiresAt.toLocaleDateString('en-GB')} to avoid losing access.
              </p>
            </div>
          </div>
        )}

        {/* Company info */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{link.companyName}</h1>
          <p className="text-gray-600 mb-6">Engagement Letter - {firmData.name}</p>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              We are pleased to offer our services as your accountants and bookkeepers. This letter confirms the terms and conditions on which {firmData.name} will provide accounting, tax, and business advisory services to {link.companyName}.
            </p>

            <div>
              <strong>Key Terms:</strong>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li>Our fees are based on the selected services and will be invoiced monthly</li>
                <li>We are regulated by the Institute of Chartered Accountants in England and Wales (ICAEW)</li>
                <li>All information provided will be treated in strict confidence</li>
                <li>We will seek your previous accountant's permission to obtain your records</li>
                <li>Our engagement may be terminated by either party with 30 days' written notice</li>
              </ul>
            </div>

            <p>
              We are committed to providing high-quality professional services. If you have any questions or require clarification on any of the above, please do not hesitate to contact us.
            </p>

            <p>Yours faithfully,<br /><strong>{firmData.name}</strong></p>
          </div>
        </div>

        {/* Previous Accountant Details Form */}
        {!isExpired && (
          <>
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Previous Accountant Details</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={prevAccountantName}
                    onChange={(e) => setPrevAccountantName(e.target.value)}
                    placeholder="e.g., Smith & Associates Ltd"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={prevAccountantEmail}
                    onChange={(e) => setPrevAccountantEmail(e.target.value)}
                    placeholder="contact@prevfirm.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={prevAccountantPhone}
                    onChange={(e) => setPrevAccountantPhone(e.target.value)}
                    placeholder="+44 20 1234 5678"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                {/* Acceptance checkbox */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 mt-1"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">
                        I accept the engagement terms
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        I confirm that I have read and understood the engagement letter above and agree to proceed on these terms.
                      </p>
                    </div>
                  </label>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!accepted || !prevAccountantName || !prevAccountantEmail || !prevAccountantPhone || submitting}
                  className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    accepted && prevAccountantName && prevAccountantEmail && prevAccountantPhone
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {submitting ? 'Submitting...' : 'Accept & Submit'}
                  {!submitting && <Mail size={20} />}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
