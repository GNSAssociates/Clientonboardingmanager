'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Clock, CheckCircle2, AlertCircle, Plus, ArrowRight } from 'lucide-react';

interface DashboardStats {
  total: number;
  sent: number;
  accepted: number;
  expired: number;
}

export default function StaffDashboard() {
  const [stats, setStats] = useState<DashboardStats>({ total: 0, sent: 0, accepted: 0, expired: 0 });

  useEffect(() => {
    fetch('/api/onboarding/dashboard')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStats({ total: d.total, sent: d.sent, accepted: d.accepted, expired: d.expired }))
      .catch(() => {});
  }, []);

  const CARDS = [
    { label: 'Total Sent', value: stats.total, icon: Users, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
    { label: 'Awaiting Signature', value: stats.sent, icon: Clock, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Accepted', value: stats.accepted, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
    { label: 'Expired', value: stats.expired, icon: AlertCircle, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  ];

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">GNS Associates — Client Onboarding Platform</p>
        </div>
        <Link
          href="/onboarding"
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-700 to-blue-900 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition-all"
        >
          <Plus size={16} />
          New Client
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`rounded-xl border p-5 ${c.bg} ${c.border}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">{c.label}</p>
                <Icon size={18} className={c.color} />
              </div>
              <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/staff/onboarding-dashboard', label: 'Onboarding Dashboard', desc: 'Track all engagement links and client signatures' },
          { href: '/onboarding', label: 'Start New Onboarding', desc: 'Generate an engagement letter for a new client' },
          { href: '/dev-login', label: 'Account Settings', desc: 'Manage your staff account and preferences' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-start justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-sm transition-all"
          >
            <div>
              <p className="font-semibold text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
            </div>
            <ArrowRight size={18} className="text-gray-400 group-hover:text-purple-600 flex-shrink-0 mt-1 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
