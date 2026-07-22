'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Users, PoundSterling, Clock, CheckCircle2, AlertTriangle, TrendingUp,
  ArrowUpRight, Plus, Building2, ChevronRight, RefreshCw, Activity,
} from 'lucide-react';

interface FirmData {
  slug: string;
  name: string;
  shortName: string;
  accentColor: string;
  companyNumber: string;
  email: string;
  partnerName: string;
  total: number;
  sent: number;
  accepted: number;
  expired: number;
  monthlyRevenue: number;
  annualRevenue: number;
}

interface Totals {
  total: number;
  sent: number;
  accepted: number;
  expired: number;
  monthlyRevenue: number;
  annualRevenue: number;
}

interface DashboardData {
  firms: FirmData[];
  totals: Totals;
}

const FIRM_LOGOS: Record<string, string> = {
  gns: '/logos/gns.png',
  llp: '/logos/gns.png',
  galaxy: '/logos/galaxy.png',
};

function fmt(n: number) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-medium w-5 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

export default function MasterDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/onboarding/firms')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Loading dashboard…</p>
      </div>
    </div>
  );

  const totals = data?.totals ?? { total: 0, sent: 0, accepted: 0, expired: 0, monthlyRevenue: 0, annualRevenue: 0 };
  const firms = data?.firms ?? [];
  const conversionRate = totals.total > 0 ? Math.round((totals.accepted / totals.total) * 100) : 0;

  const globalKpis = [
    {
      label: 'Active Clients',
      value: totals.accepted,
      sub: `${totals.total} total onboardings`,
      icon: Users,
      color: '#1e3a8a',
      trend: `${conversionRate}% conversion`,
    },
    {
      label: 'Monthly Revenue',
      value: `£${fmt(totals.monthlyRevenue)}`,
      sub: `£${fmt(totals.annualRevenue)} annually`,
      icon: PoundSterling,
      color: '#0891b2',
      trend: 'All firms combined',
    },
    {
      label: 'Awaiting Signature',
      value: totals.sent,
      sub: 'Engagement links sent',
      icon: Clock,
      color: '#d97706',
      trend: 'Pending client action',
    },
    {
      label: 'Completion Rate',
      value: `${conversionRate}%`,
      sub: `${totals.accepted} signed of ${totals.total}`,
      icon: TrendingUp,
      color: '#16a34a',
      trend: 'Across all firms',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Nav bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 relative">
              <Image src="/logos/gns.png" alt="GNS" fill className="object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">GNS Associates</p>
              <p className="text-xs text-gray-400">Group Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <RefreshCw size={16} />
            </button>
            <Link href="/onboarding"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-lg transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}>
              <Plus size={14} /> New Onboarding
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Welcome */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Good morning</h1>
            <p className="text-sm text-gray-400 mt-1">{today}</p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-700">All systems operational</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {globalKpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: kpi.color + '15' }}>
                    <Icon size={18} style={{ color: kpi.color }} />
                  </div>
                  <span className="text-xs text-gray-400 font-medium text-right leading-tight max-w-[80px]">{kpi.trend}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-0.5">{kpi.value}</p>
                <p className="text-xs font-semibold text-gray-500">{kpi.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Revenue bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Revenue by Firm</h2>
              <p className="text-xs text-gray-400 mt-0.5">Monthly recurring revenue</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900">
                £{fmt(totals.monthlyRevenue)}
                <span className="text-sm font-normal text-gray-400">/month</span>
              </p>
              <p className="text-xs text-gray-400">£{fmt(totals.annualRevenue)}/year</p>
            </div>
          </div>
          <div className="space-y-4">
            {firms.map((f) => (
              <div key={f.slug}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: f.accentColor }} />
                    <span className="text-sm font-medium text-gray-700">{f.name}</span>
                    <span className="text-xs text-gray-400 hidden sm:inline">{f.accepted} clients</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: f.accentColor }}>
                    £{fmt(f.monthlyRevenue)}/mo
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: totals.monthlyRevenue > 0
                        ? `${(f.monthlyRevenue / totals.monthlyRevenue) * 100}%`
                        : '0%',
                      background: `linear-gradient(90deg, ${f.accentColor}, #1e3a8a)`,
                    }} />
                </div>
              </div>
            ))}
            {totals.monthlyRevenue === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No revenue data yet — complete onboardings to see revenue.
              </p>
            )}
          </div>
        </div>

        {/* Firm cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Operating Entities</h2>
            <span className="text-xs text-gray-400">{firms.length} firms</span>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {firms.map((f) => {
              const rate = f.total > 0 ? Math.round((f.accepted / f.total) * 100) : 0;
              return (
                <Link key={f.slug} href={`/staff/firms/${f.slug}`}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 overflow-hidden group">
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${f.accentColor}, #1e3a8a)` }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 relative">
                          <Image src={FIRM_LOGOS[f.slug] ?? '/logos/gns.png'} alt={f.name} fill className="object-contain" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight">{f.name}</p>
                          <p className="text-xs text-gray-400 font-mono">CH {f.companyNumber || '—'}</p>
                        </div>
                      </div>
                      <ArrowUpRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5" />
                    </div>

                    <div className="space-y-2.5 mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Total onboardings</span>
                        <span className="font-bold text-gray-900">{f.total}</span>
                      </div>
                      <MiniBar value={f.accepted} max={Math.max(f.total, 1)} color="#16a34a" />
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>{f.accepted} signed</span>
                        <span>{f.sent} pending</span>
                        <span>{f.expired} expired</span>
                      </div>
                    </div>

                    <div className="pt-3.5 border-t border-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold" style={{ color: f.accentColor }}>
                            £{fmt(f.monthlyRevenue)}
                          </p>
                          <p className="text-xs text-gray-400">per month + VAT</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-600">{rate}%</p>
                          <p className="text-xs text-gray-400">conversion</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-400">{f.partnerName}</span>
                      <span className="text-xs font-semibold flex items-center gap-1 transition-colors"
                        style={{ color: f.accentColor }}>
                        View Dashboard <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'New Onboarding', icon: Plus, href: '/onboarding', color: '#cc2229' },
              { label: 'GNS Ltd Dashboard', icon: Building2, href: '/staff/firms/gns', color: '#cc2229' },
              { label: 'LLP Dashboard', icon: Building2, href: '/staff/firms/llp', color: '#1e3a8a' },
              { label: 'Galaxy Dashboard', icon: Building2, href: '/staff/firms/galaxy', color: '#7c3aed' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.label} href={action.href}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: action.color + '15' }}>
                    <Icon size={15} style={{ color: action.color }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                    {action.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Pipeline dark card */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-white">Onboarding Pipeline</h2>
              <p className="text-xs text-white/40 mt-0.5">All firms combined</p>
            </div>
            <Activity size={18} className="text-white/30" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Awaiting Signature', value: totals.sent, color: '#f59e0b', icon: Clock },
              { label: 'Signed & Active', value: totals.accepted, color: '#22c55e', icon: CheckCircle2 },
              { label: 'Expired / Lapsed', value: totals.expired, color: '#ef4444', icon: AlertTriangle },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                  <Icon size={20} className="mx-auto mb-2" style={{ color: item.color }} />
                  <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                  <p className="text-xs text-white/50 mt-1">{item.label}</p>
                </div>
              );
            })}
          </div>
          {totals.total > 0 && (
            <div className="mt-5">
              <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                {[
                  { value: totals.sent, color: '#f59e0b' },
                  { value: totals.accepted, color: '#22c55e' },
                  { value: totals.expired, color: '#ef4444' },
                ].map((seg, i) => (
                  <div key={i} className="h-full transition-all duration-700"
                    style={{ width: `${(seg.value / totals.total) * 100}%`, background: seg.color }} />
                ))}
              </div>
              <p className="text-xs text-white/40 mt-2 text-center">{totals.total} total onboardings</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
