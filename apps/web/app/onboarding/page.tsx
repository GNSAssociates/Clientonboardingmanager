'use client';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

const FIRMS = [
  {
    id: 'gns',
    name: 'GNS Associates',
    description: 'Comprehensive accounting & compliance services for small to mid-market businesses',
    color: 'from-purple-500 to-purple-600',
    accent: 'purple',
  },
  {
    id: 'llp',
    name: 'GNS Associates LLP',
    description: 'Partnership-focused accounting, tax planning, and business advisory',
    color: 'from-indigo-500 to-indigo-600',
    accent: 'indigo',
  },
  {
    id: 'galaxy',
    name: 'Galaxy (GXY)',
    description: 'Specialized services for tech startups and growth-stage companies',
    color: 'from-violet-500 to-violet-600',
    accent: 'violet',
  },
];

export default function OnboardingStart() {
  const [selectedFirm, setSelectedFirm] = useState<string | null>(null);

  const handleSelect = (firmId: string) => {
    setSelectedFirm(firmId);
    // Redirect to services page after brief delay
    setTimeout(() => {
      window.location.href = `/onboarding/services?firm=${firmId}`;
    }, 300);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Welcome to Client Onboarding
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Select your firm to get started. We'll guide you through the onboarding process in just a few minutes.
          </p>
        </div>

        {/* Firm selector cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {FIRMS.map((firm) => (
            <button
              key={firm.id}
              onClick={() => handleSelect(firm.id)}
              className={`group relative overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-105 ${
                selectedFirm === firm.id ? 'ring-2 ring-purple-400' : ''
              }`}
            >
              {/* Card background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${firm.color} opacity-90 group-hover:opacity-100 transition-opacity`} />

              {/* Decorative blur */}
              <div className="absolute inset-0 bg-white/10 backdrop-blur-xl" />

              {/* Content */}
              <div className="relative p-8 text-left h-full flex flex-col justify-between min-h-64">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">{firm.name}</h3>
                  <p className="text-purple-100 text-sm leading-relaxed">{firm.description}</p>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 text-white group-hover:gap-3 transition-all mt-6">
                  <span className="text-sm font-semibold">Select Firm</span>
                  <ChevronRight size={16} />
                </div>
              </div>

              {/* Hover glow */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all" />
            </button>
          ))}
        </div>

        {/* Footer link */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Already onboarded?{' '}
            <Link href="/dev-login" className="text-purple-600 hover:text-purple-700 font-semibold">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
