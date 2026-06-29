'use client';
import { useState } from 'react';
import { ChevronRight, Building2 } from 'lucide-react';
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
    }, 250);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 relative">
              <Image src="/logos/gns.png" alt="GNS" fill className="object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">GNS Associates</p>
              <p className="text-xs text-gray-400">Client Onboarding Portal</p>
            </div>
          </div>
          <Link href="/dev-login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Staff login →
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-xs font-semibold text-blue-700 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              New Client Onboarding
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Select the firm for this client
            </h1>
            <p className="text-gray-500 max-w-xl mx-auto">
              Choose which GNS entity will be engaged. The engagement letter, branding, and signatory will be set accordingly.
            </p>
          </div>

          {/* Firm cards */}
          <div className="grid md:grid-cols-3 gap-5">
            {FIRM_LIST.map((firm) => {
              const isSelected = selectedFirm === firm.slug;
              return (
                <button
                  key={firm.slug}
                  onClick={() => handleSelect(firm.slug)}
                  className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 bg-white hover:shadow-xl hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-blue-500 shadow-xl -translate-y-0.5'
                      : 'border-gray-100 hover:border-gray-200 shadow-sm'
                  }`}
                >
                  {/* Coloured top stripe */}
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${firm.accentColor}, #1e3a8a)` }} />

                  <div className="p-6">
                    {/* Logo + name */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <Image
                          src={firm.logo}
                          alt={firm.name}
                          width={44}
                          height={44}
                          className="object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              const icon = document.createElement('div');
                              icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${firm.accentColor}" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
                              parent.appendChild(icon);
                            }
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 leading-tight">{firm.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">CH {firm.companyNumber}</p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-500 leading-relaxed mb-5 line-clamp-2">{firm.description}</p>

                    {/* Details */}
                    <div className="space-y-1.5 mb-5">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Building2 size={11} className="flex-shrink-0" />
                        <span className="truncate">{firm.address}, {firm.postcode}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="text-gray-300">✍</span>
                        <span>{firm.partnerName} · {firm.partnerTitle}</span>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className={`flex items-center justify-between pt-4 border-t border-gray-50 transition-all ${isSelected ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                      <span className="text-xs font-semibold">{isSelected ? 'Selected — loading…' : 'Select this firm'}</span>
                      <ChevronRight size={14} className={`transition-transform ${isSelected ? 'translate-x-1' : 'group-hover:translate-x-0.5'}`} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Step indicator */}
          <div className="mt-10 flex items-center justify-center gap-2">
            {['Select Firm', 'Services & Pricing', 'Company Lookup', 'Send Link'].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 ${i === 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{step}</span>
                </div>
                {i < 3 && <div className="w-6 h-px bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
