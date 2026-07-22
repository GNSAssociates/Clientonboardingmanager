import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, Shield, Clock, FileText, Users, Building2 } from 'lucide-react';

const FEATURES = [
  {
    icon: Building2,
    title: 'Companies House Verification',
    desc: 'Company details verified live — no manual data entry. Directors auto-extracted.',
  },
  {
    icon: FileText,
    title: 'Digital Engagement Letters',
    desc: 'Professional pre-filled letters sent by email. Client signs online in minutes.',
  },
  {
    icon: Shield,
    title: 'Professional Clearance',
    desc: 'Automatic letter to previous accountant requesting records on your behalf.',
  },
  {
    icon: Clock,
    title: '30-Day Secure Links',
    desc: 'Every engagement link expires automatically. Expiry warnings keep you on top of it.',
  },
  {
    icon: Users,
    title: 'Multi-Firm Support',
    desc: 'GNS Associates Ltd, GNS Associates UK LLP and Galaxy all in one platform.',
  },
  {
    icon: CheckCircle2,
    title: 'Instant Notifications',
    desc: 'Three automated emails fire the moment a client accepts — firm, client, and previous accountant all notified.',
  },
];

const STEPS = [
  { n: '1', title: 'Select firm & services', desc: 'Choose GNS, LLP or Galaxy. Pick services and set agreed monthly prices.' },
  { n: '2', title: 'Verify company', desc: 'Enter the Companies House number — we pull everything automatically.' },
  { n: '3', title: 'Send engagement link', desc: 'A secure 30-day link is emailed to the director with the full engagement letter.' },
  { n: '4', title: 'Client signs', desc: 'Director reads, fills in previous accountant details, and signs the declaration.' },
  { n: '5', title: 'Automatic handover', desc: 'We email the previous accountant, notify the firm, and confirm to the client — all instantly.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 relative">
              <Image src="/logos/gns.png" alt="GNS" fill className="object-contain" />
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight text-sm">GNS Associates</p>
              <p className="text-xs text-gray-500 leading-tight">Chartered Accountants</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/staff" className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2">
              Staff Portal
            </Link>
            <Link
              href="/onboarding"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}
            >
              Start Onboarding
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, #cc2229 0%, transparent 50%), radial-gradient(circle at 80% 20%, #1e3a8a 0%, transparent 50%)',
        }} />

        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium mb-8 text-white/80">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Regulated by ICAEW · Est. 2012
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Client Onboarding,<br />
              <span style={{ color: '#ef4444' }}>Done Properly.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-10 max-w-2xl">
              Digitise your entire new client intake — from engagement letter to professional clearance — in under 5 minutes. No paperwork. No chasing. Everything automated.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/onboarding"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-lg transition-all hover:scale-105 hover:shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #cc2229, #991b1b)' }}
              >
                Start New Onboarding
                <ArrowRight size={20} />
              </Link>
              <Link
                href="/staff"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/10 border border-white/20 text-white font-semibold text-lg hover:bg-white/20 transition-all"
              >
                Staff Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How it works</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Five steps from selecting a firm to having a fully onboarded client.</p>
          </div>
          <div className="relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-red-200 via-purple-200 to-blue-200 mx-16" />
            <div className="grid md:grid-cols-5 gap-6 relative">
              {STEPS.map((step) => (
                <div key={step.n} className="flex flex-col items-center text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg mb-4 z-10 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}
                  >
                    {step.n}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm">{step.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything built in</h2>
            <p className="text-gray-500 max-w-xl mx-auto">No third-party tools required. The entire workflow runs inside this platform.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-red-200 hover:shadow-md transition-all group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon size={22} className="text-red-700" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Firms */}
      <section className="py-16 bg-gradient-to-br from-slate-900 to-blue-950 text-white">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-white/50 text-sm font-medium uppercase tracking-widest mb-8">Operating entities</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { name: 'GNS Associates Limited', ch: '08086819', color: '#cc2229' },
              { name: 'GNS Associates UK LLP', ch: 'OC428532', color: '#1e3a8a' },
              { name: 'Galaxy Accountants', ch: 'Coming soon', color: '#7c3aed' },
            ].map((firm) => (
              <div key={firm.name} className="p-5 rounded-xl bg-white/5 border border-white/10">
                <div className="w-10 h-1.5 rounded-full mb-4" style={{ background: firm.color }} />
                <p className="font-semibold text-white">{firm.name}</p>
                <p className="text-xs text-white/40 mt-1 font-mono">{firm.ch}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to onboard a new client?</h2>
          <p className="text-gray-500 mb-8">Takes less than 5 minutes. The system handles everything after that.</p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-white font-bold text-lg transition-all hover:scale-105 hover:shadow-xl"
            style={{ background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}
          >
            Get Started
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 relative">
              <Image src="/logos/gns.png" alt="GNS" fill className="object-contain" />
            </div>
            <span>© {new Date().getFullYear()} GNS Associates Limited. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <span>Regulated by ICAEW</span>
            <span>·</span>
            <a href="mailto:info@gnsassociates.co.uk" className="hover:text-gray-700">info@gnsassociates.co.uk</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
