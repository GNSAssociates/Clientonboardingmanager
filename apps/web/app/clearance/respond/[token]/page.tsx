'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ClearanceData {
  companyName: string;
  companyNumber: string;
  directorName: string;
  firmName: string;
  firmEmail: string;
  firmLogo: string;
  firmAccent: string;
  firmRegStatement: string;
  requestedAt: string;
}

export default function ClearanceResponsePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ClearanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [decision, setDecision] = useState<'accept' | 'reject' | ''>('');
  const [outstandingFees, setOutstandingFees] = useState('no');
  const [feeAmount, setFeeAmount] = useState('');
  const [concerns, setConcerns] = useState('');
  const [transferMethod, setTransferMethod] = useState('email');
  const [respondentName, setRespondentName] = useState('');
  const [respondentFirm, setRespondentFirm] = useState('');

  useEffect(() => {
    fetch(`/api/clearance/${token}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError('This clearance request link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision || !respondentName || !respondentFirm) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clearance/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, outstandingFees, feeAmount, concerns, transferMethod, respondentName, respondentFirm }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch {
      setError('Failed to submit your response. Please try again or reply directly by email.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-gray-400" size={36} />
    </div>
  );

  if (error && !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md bg-white rounded-2xl p-10 shadow text-center">
        <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link Not Found</h1>
        <p className="text-gray-500">{error}</p>
      </div>
    </div>
  );

  const firm = data!;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md bg-white rounded-2xl p-10 shadow text-center">
        <CheckCircle2 className="text-green-500 mx-auto mb-4" size={64} />
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Response Submitted</h1>
        <p className="text-gray-600 mb-6">
          Thank you, <strong>{respondentName}</strong>. Your response regarding <strong>{firm.companyName}</strong> has been sent to <strong>{firm.firmName}</strong>.
        </p>
        {decision === 'accept' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
            We will contact you shortly to arrange the transfer of records.
          </div>
        )}
        {decision === 'reject' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            {firm.firmName} has been notified of your concerns.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Letterhead */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-2" style={{ background: `linear-gradient(to right, ${firm.firmAccent}, #1e3a8a)` }} />
          <div className="p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 flex items-center justify-center">
                  <Image src={firm.firmLogo} alt={firm.firmName} width={64} height={64} className="object-contain" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{firm.firmName}</h2>
                  <p className="text-sm text-gray-500">{firm.firmEmail}</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 text-right flex-shrink-0">{today}</p>
            </div>

            <div className="prose prose-sm text-gray-700 space-y-4">
              <p>Dear Colleague,</p>
              <p>
                We have been appointed as accountants to <strong>{firm.companyName}</strong> (Company No. {firm.companyNumber}), effective from {today}. The director, <strong>{firm.directorName}</strong>, has authorised us to contact you to request professional clearance and the handover of accounting records.
              </p>
              <p>
                We would be grateful if you could confirm there are no circumstances that would prevent us from accepting this appointment, and arrange the transfer of the following records:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>Latest filed statutory accounts and corporation tax computations</li>
                <li>Prior year working papers and trial balance</li>
                <li>Payroll records and employee details (if applicable)</li>
                <li>VAT returns history and workings</li>
                <li>HMRC correspondence and reference numbers</li>
                <li>Accounting software access (Xero, QuickBooks, Sage etc.)</li>
              </ul>
              <p>Please use the form below to confirm your response. This request was sent on {firm.requestedAt}.</p>
            </div>
          </div>
        </div>

        {/* Response Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
          <h3 className="text-lg font-bold text-gray-900">Your Response</h3>

          {/* Respondent details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Full Name *</label>
              <input
                type="text"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Firm Name *</label>
              <input
                type="text"
                value={respondentFirm}
                onChange={(e) => setRespondentFirm(e.target.value)}
                placeholder="Previous Accountants Ltd"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>
          </div>

          {/* Decision */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Professional Clearance Decision *</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${decision === 'accept' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="decision" value="accept" checked={decision === 'accept'} onChange={() => setDecision('accept')} className="mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Grant Clearance</p>
                  <p className="text-xs text-gray-500 mt-0.5">I confirm there are no reasons to prevent this appointment</p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${decision === 'reject' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="decision" value="reject" checked={decision === 'reject'} onChange={() => setDecision('reject')} className="mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Withhold Clearance</p>
                  <p className="text-xs text-gray-500 mt-0.5">There are matters I need to bring to your attention</p>
                </div>
              </label>
            </div>
          </div>

          {/* Outstanding fees */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Outstanding Fees</label>
            <div className="flex gap-4">
              {['no', 'yes'].map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="fees" value={v} checked={outstandingFees === v} onChange={() => setOutstandingFees(v)} />
                  <span className="text-sm text-gray-700">{v === 'no' ? 'No outstanding fees' : 'Yes, fees are owed'}</span>
                </label>
              ))}
            </div>
            {outstandingFees === 'yes' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="Amount owed, e.g. £1,250"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            )}
          </div>

          {/* Concerns / notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Additional Comments {decision === 'reject' && <span className="text-red-600">*</span>}
            </label>
            <textarea
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              placeholder={decision === 'reject' ? 'Please state the reasons for withholding clearance...' : 'Any additional information for the incoming accountants (optional)'}
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              required={decision === 'reject'}
            />
          </div>

          {/* Records transfer method */}
          {decision === 'accept' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">How will you transfer the records?</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { v: 'email', l: 'By Email' },
                  { v: 'post', l: 'By Post' },
                  { v: 'portal', l: 'Secure Portal' },
                  { v: 'contact', l: 'Please Contact Me' },
                ].map((opt) => (
                  <label key={opt.v} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-all ${transferMethod === opt.v ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <input type="radio" name="transfer" value={opt.v} checked={transferMethod === opt.v} onChange={() => setTransferMethod(opt.v)} className="sr-only" />
                    {opt.l}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!decision || !respondentName || !respondentFirm || submitting}
            className={`w-full py-3.5 rounded-xl font-bold text-white transition-all ${
              !decision || !respondentName || !respondentFirm
                ? 'bg-gray-300 cursor-not-allowed'
                : 'hover:shadow-lg hover:scale-[1.01]'
            }`}
            style={(!decision || !respondentName || !respondentFirm) ? {} : { background: `linear-gradient(135deg, ${firm.firmAccent}, #1e3a8a)` }}
          >
            {submitting ? 'Submitting...' : 'Submit Professional Clearance Response'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            This response is securely recorded. By submitting you confirm the information is accurate to the best of your knowledge.
          </p>
        </form>

        <p className="text-center text-xs text-gray-400">{firm.firmRegStatement}</p>
      </div>
    </div>
  );
}
