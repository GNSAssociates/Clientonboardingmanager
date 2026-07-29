'use client';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Home } from 'lucide-react';

/**
 * Slim Back / Home bar shown above every onboarding wizard step.
 * Back = browser history back (mirrors each step's own in-page Back button).
 * Home = the professional-clearance dashboard, the staff team's usual landing
 * page when they are mid-onboarding a client.
 */
export function OnboardingHeader() {
  const router = useRouter();
  return (
    <div className="relative z-10 max-w-3xl mx-auto px-4 pt-4 flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-white/70 hover:bg-white border border-gray-200 transition-colors"
      >
        <ChevronLeft size={14} /> Back
      </button>
      <button
        type="button"
        onClick={() => router.push('/staff/clearance')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-white/70 hover:bg-white border border-gray-200 transition-colors"
      >
        <Home size={14} /> Home
      </button>
    </div>
  );
}
