'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface UserInfo {
  authenticated: boolean;
  userId: string;
  displayName: string;
  roles: string[];
  isAdmin: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrator',
  Partner: 'Partner',
  Manager: 'Manager',
  HR: 'Human Resources',
  OnboardingStaff: 'Onboarding Staff',
  Reviewer: 'Reviewer',
  ComplianceOfficer: 'Compliance Officer',
  Client: 'Client',
};

const CAN_ACCESS_ONBOARDING = ['Admin', 'Partner', 'Manager', 'HR', 'OnboardingStaff', 'ComplianceOfficer'];
const CAN_ACCESS_INVOICES = ['Admin', 'Partner', 'Manager', 'OnboardingStaff', 'Reviewer'];
const CAN_MANAGE_STAFF = ['Admin', 'Partner', 'HR'];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStaffPanel, setShowStaffPanel] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) { router.push('/login'); return null; }
        return r.json();
      })
      .then((d) => { if (d) setUser(d); })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  const canOnboard = user.isAdmin || user.roles.some((r) => CAN_ACCESS_ONBOARDING.includes(r));
  const canInvoice = user.isAdmin || user.roles.some((r) => CAN_ACCESS_INVOICES.includes(r));
  const canManageStaff = user.isAdmin || user.roles.some((r) => CAN_MANAGE_STAFF.includes(r));
  const roleLabel = user.roles.map((r) => ROLE_LABELS[r] || r).join(', ') || 'Staff';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/40">
      {/* Top bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logos/gns.png" alt="GNS" width={36} height={36} className="object-contain" />
            <div>
              <p className="text-sm font-bold text-gray-900">GNS Compliance Manager</p>
              <p className="text-[11px] text-gray-400">GNS Associates UK</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {canManageStaff && (
              <Link
                href="/dashboard/staff"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Manage Staff
              </Link>
            )}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{user.displayName}</p>
                <p className="text-[11px] text-gray-400">{roleLabel}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome section */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.displayName?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Client Onboarding */}
          {canOnboard && (
            <Link href="/staff/dashboard" className="group block">
              <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-8 shadow-sm hover:shadow-xl hover:border-purple-200 transition-all duration-300 hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-purple-100/60 to-transparent rounded-bl-full" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-purple-200/50 group-hover:scale-110 transition-transform">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Onboard Client</h2>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">
                    Manage professional clearance, compliance, engagement letters, KYC checks, and the full client onboarding pipeline across all GNS entities.
                  </p>
                  <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Open Onboarding
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Invoice Summarizer */}
          {canInvoice && (
            <Link href="/invoices" className="group block">
              <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-8 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300 hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-100/60 to-transparent rounded-bl-full" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-200/50 group-hover:scale-110 transition-transform">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Invoice Summarizer</h2>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">
                    AI-powered invoice extraction, bank reconciliation, sales processing, and Amazon VAT summaries. Upload documents and get structured data instantly.
                  </p>
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Open Invoices
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Quick actions */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {canOnboard && (
              <Link href="/onboarding" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">New Onboarding</p>
                  <p className="text-[11px] text-gray-400">Start client process</p>
                </div>
              </Link>
            )}
            {canInvoice && (
              <Link href="/invoices" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Upload Invoices</p>
                  <p className="text-[11px] text-gray-400">Extract & summarize</p>
                </div>
              </Link>
            )}
            {canManageStaff && (
              <Link href="/dashboard/staff" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Add Staff</p>
                  <p className="text-[11px] text-gray-400">Manage team members</p>
                </div>
              </Link>
            )}
            {canOnboard && (
              <Link href="/staff/clearance" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Clearance</p>
                  <p className="text-[11px] text-gray-400">Professional clearance</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
