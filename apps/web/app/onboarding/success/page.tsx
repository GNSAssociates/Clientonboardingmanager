'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Mail, Calendar, FileCheck, Loader2 } from 'lucide-react';
import { getFirm } from '@/lib/firms';

const NEXT_STEPS = [
  {
    icon: Mail,
    title: 'Engagement Letter Sent',
    description: 'The client will receive an email with a link to read and sign the engagement letter online.',
    timeline: 'Now',
  },
  {
    icon: FileCheck,
    title: 'Professional Clearance',
    description: 'Once the client signs, we will contact their previous accountant to request a professional handover of records.',
    timeline: 'Upon client signature',
  },
  {
    icon: Calendar,
    title: 'Onboarding Call',
    description: 'A member of the team will schedule a welcome call to discuss requirements and next steps.',
    timeline: 'Within 2 business days of signing',
  },
];

function SuccessPageInner() {
  const searchParams = useSearchParams();
  const firmSlug = searchParams.get('firm') || 'gns';
  const company = searchParams.get('company') || 'the company';
  const clientEmail = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';

  const firm = getFirm(firmSlug);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* Success icon */}
        <div className="text-center mb-10">
          <div className="inline-flex mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-40" />
              <CheckCircle2 size={80} className="text-green-500 relative" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Engagement Link Sent!</h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            The client has been sent their engagement letter and will be able to review and sign it online.
          </p>
        </div>

        {/* Summary card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-8">
          <div className="h-2" style={{ background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }} />
          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <Image src={firm.logo} alt={firm.name} width={48} height={48} className="object-contain" />
              <div>
                <p className="text-xs text-gray-500">Sent on behalf of</p>
                <p className="font-bold text-gray-900">{firm.legalName}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Company</span>
                <span className="font-semibold text-gray-900">{decodeURIComponent(company)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Engagement link sent to</span>
                <span className="font-semibold text-gray-900">{decodeURIComponent(clientEmail)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Firm notified at</span>
                <span className="font-semibold text-gray-900">{firm.email}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Link expires</span>
                <span className="font-semibold text-gray-900">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Next steps */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-5">What happens next?</h2>
          <div className="space-y-3">
            {NEXT_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Icon className="text-purple-600" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{step.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{step.description}</p>
                    <p className="text-xs text-purple-600 font-medium mt-1">{step.timeline}</p>
                  </div>
                  <span className="text-3xl text-gray-200 font-light flex-shrink-0">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Questions */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
          <p className="font-semibold text-gray-900 mb-2">Need help?</p>
          <p className="text-sm text-gray-600 mb-3">
            Contact us if you have any questions about this engagement.
          </p>
          <a
            href={`mailto:${firm.email}`}
            className="inline-flex items-center gap-2 font-semibold text-sm hover:underline"
            style={{ color: firm.accentColor }}
          >
            <Mail size={15} />
            {firm.email}
          </a>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/staff/onboarding-dashboard"
            className="flex-1 py-3 text-white rounded-xl font-semibold text-center hover:shadow-lg transition-all"
            style={{ background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }}
          >
            View Dashboard
          </Link>
          <Link
            href="/onboarding"
            className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-center hover:border-gray-400 transition-all"
          >
            Onboard Another Client
          </Link>
        </div>

        {/* Reference */}
        <div className="mt-8 pt-6 border-t text-center">
          {token && (
            <p className="text-sm text-gray-500 mb-1">
              Reference: <span className="font-mono text-gray-700">{token.substring(0, 8).toUpperCase()}</span>
            </p>
          )}
          <p className="text-xs text-gray-400">This session has been securely recorded by {firm.legalName}</p>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={32} />
      </div>
    }>
      <SuccessPageInner />
    </Suspense>
  );
}
