'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Mail, Calendar, FileCheck, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
      style={copied
        ? { background: '#f0fdf4', borderColor: '#86efac', color: '#16a34a' }
        : { background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }
      }
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}

function SuccessPageInner() {
  const searchParams = useSearchParams();
  const firmSlug = searchParams.get('firm') || 'gns';
  const company = searchParams.get('company') || 'the company';
  const clientEmail = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';

  const firm = getFirm(firmSlug);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? '';
  const engageUrl = token ? `${baseUrl}/onboarding/engage/${token}` : '';

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
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="h-2" style={{ background: `linear-gradient(to right, ${firm.accentColor}, #1e3a8a)` }} />
          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <Image src={firm.logo} alt={firm.name} width={48} height={48} className="object-contain" />
              <div>
                <p className="text-xs text-gray-500">Sent on behalf of</p>
                <p className="font-bold text-gray-900">{firm.legalName}</p>
              </div>
            </div>
            <div className="space-y-0 text-sm divide-y divide-gray-100">
              <div className="flex justify-between py-2.5">
                <span className="text-gray-500">Company</span>
                <span className="font-semibold text-gray-900">{decodeURIComponent(company)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-gray-500">Engagement link sent to</span>
                <span className="font-semibold text-gray-900">{decodeURIComponent(clientEmail)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-gray-500">Firm notified at</span>
                <span className="font-semibold text-gray-900">{firm.email}</span>
              </div>
              <div className="flex justify-between py-2.5">
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

        {/* Shareable link */}
        {engageUrl && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-sm font-semibold text-blue-900">Shareable Engagement Link</p>
                <p className="text-xs text-blue-600 mt-0.5">Send via WhatsApp, SMS, or any platform if email isn&apos;t received</p>
              </div>
              <a
                href={engageUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-shrink-0 p-1.5 text-blue-500 hover:text-blue-700 transition-colors"
                title="Open link"
              >
                <ExternalLink size={15} />
              </a>
            </div>
            <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
              <p className="flex-1 text-xs font-mono text-gray-600 truncate">{engageUrl}</p>
              <CopyButton text={engageUrl} />
            </div>
          </div>
        )}

        {/* Next steps */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">What happens next?</h2>
          <div className="space-y-3">
            {NEXT_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl">
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

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/staff/dashboard"
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
