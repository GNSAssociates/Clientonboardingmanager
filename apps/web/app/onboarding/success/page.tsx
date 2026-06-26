'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Mail, Calendar, FileCheck } from 'lucide-react';

const FIRM_INFO: Record<string, { name: string; email: string }> = {
  gns: { name: 'GNS Associates', email: 'onboarding@gnsassociates.co.uk' },
  llp: { name: 'GNS Associates LLP', email: 'onboarding@gnsassociates-llp.co.uk' },
  galaxy: { name: 'Galaxy (GXY)', email: 'onboarding@galaxy.co.uk' },
};

const NEXT_STEPS = [
  {
    icon: Mail,
    title: 'Verification Email',
    description: 'Check your inbox for a verification email with next steps',
    timeline: 'Within 5 minutes',
  },
  {
    icon: FileCheck,
    title: 'Records Request',
    description: 'We\'ll contact your previous accountant to request your records',
    timeline: 'Within 24 hours',
  },
  {
    icon: Calendar,
    title: 'Onboarding Call',
    description: 'A member of our team will schedule a call to discuss your requirements',
    timeline: 'Within 2 business days',
  },
];

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const firm = searchParams.get('firm') || 'gns';
  const company = searchParams.get('company') || 'Your Company';
  const clientEmail = searchParams.get('email') || '';
  const firmData = FIRM_INFO[firm] || FIRM_INFO.gns;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Success animation */}
        <div className="text-center mb-12">
          <div className="inline-flex mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full animate-pulse" />
              <CheckCircle2 size={80} className="text-green-500 relative" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to {firmData.name}!
          </h1>

          <p className="text-xl text-gray-600 max-w-xl mx-auto">
            Your onboarding has been successfully initiated. We're excited to work with you and help grow your business.
          </p>
        </div>

        {/* Company confirmation */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-8 mb-12">
          <p className="text-sm text-gray-600 mb-2">Company being onboarded</p>
          <p className="text-2xl font-bold text-gray-900">{company}</p>
          <div className="space-y-2 mt-4">
            <p className="text-sm text-gray-600">
              Engagement link sent to: <span className="font-semibold text-gray-900">{clientEmail}</span>
            </p>
            <p className="text-sm text-gray-600">
              Confirmation sent to: <span className="font-semibold text-gray-900">{firmData.email}</span>
            </p>
          </div>
        </div>

        {/* Next steps */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">What happens next?</h2>

          <div className="space-y-4">
            {NEXT_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className="flex gap-4 p-6 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all"
                >
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100">
                      <Icon className="text-purple-600" size={24} />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{step.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                    <p className="text-xs text-gray-500 mt-2">{step.timeline}</p>
                  </div>

                  <div className="text-3xl text-gray-300 font-light">{index + 1}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQ / Contact */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Questions?</h3>
          <p className="text-gray-600 mb-4">
            If you have any questions during the onboarding process, please don't hesitate to reach out to our team.
          </p>
          <a
            href={`mailto:${firmData.email}`}
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-semibold"
          >
            <Mail size={16} />
            {firmData.email}
          </a>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dev-login"
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-center"
          >
            Sign In to Portal
          </Link>
          <Link
            href="/"
            className="px-8 py-3 border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all text-center"
          >
            Back to Home
          </Link>
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t text-center">
          <p className="text-sm text-gray-500">
            Confirmation ID: <span className="font-mono text-gray-700">{Date.now().toString().slice(-8).toUpperCase()}</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            This onboarding session has been securely recorded
          </p>
        </div>
      </div>
    </div>
  );
}
