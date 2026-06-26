'use client';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { FIRMS } from '@/lib/firms';

const FIRM_LIST = Object.values(FIRMS);

export default function OnboardingStart() {
  const [selectedFirm, setSelectedFirm] = useState<string | null>(null);

  const handleSelect = (slug: string) => {
    setSelectedFirm(slug);
    setTimeout(() => {
      window.location.href = `/onboarding/services?firm=${slug}`;
    }, 300);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Client Onboarding
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Select the firm you are onboarding this client for.
          </p>
        </div>

        {/* Firm selector cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {FIRM_LIST.map((firm) => (
            <button
              key={firm.slug}
              onClick={() => handleSelect(firm.slug)}
              className={`group relative overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                selectedFirm === firm.slug ? 'ring-4 ring-purple-400 scale-105' : ''
              }`}
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${firm.gradient} opacity-95`} />

              {/* Subtle shimmer */}
              <div className="absolute inset-0 bg-white/5" />

              {/* Content */}
              <div className="relative p-8 text-left h-full flex flex-col justify-between min-h-64">
                {/* Logo area */}
                <div className="mb-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4 overflow-hidden">
                    <Image
                      src={firm.logo}
                      alt={firm.name}
                      width={56}
                      height={56}
                      className="object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white leading-tight">{firm.name}</h3>
                  <p className="text-xs text-white/70 mt-0.5 font-mono">{firm.legalName}</p>
                </div>

                <p className="text-white/80 text-sm leading-relaxed mb-6">{firm.description}</p>

                {/* CTA */}
                <div className="flex items-center gap-2 text-white group-hover:gap-3 transition-all">
                  <span className="text-sm font-semibold">Select this firm</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
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
