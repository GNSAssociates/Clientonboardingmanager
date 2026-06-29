'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, TrendingUp, Clock, CheckCircle2, XCircle,
  AlertTriangle, Mail, RefreshCw, Plus, ChevronRight, Users, PoundSterling,
  FileText, Send, Bell, ArrowUpRight,
} from 'lucide-react';

interface LinkRow {
  id: string;
  token: string;
  companyName: string;
  companyNumber: string;
  clientEmail: string;
  directorName: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  services: Array<{ name: string; price: number }> | null;
  prevAccountantEmail: string | null;
  prevAccountantFirmName: string | null;
  clientFollowUpCount: number;
  prevAccountantFollowUpCount: number;
  clientFollowUpSentAt: string | null;
  prevAccountantFollowUpSentAt: string | null;
}

interface FirmStats {
  firm: { slug: string; name: string; accentColor: string; email: string; phone: string; partnerName: string };
  stats: {
    total: number; sent: number; accepted: number; expired: number;
    expiringWithin7Days: number; monthlyRevenue: number; annualRevenue: number; pendingClearance: number;
  };
  links: LinkRow[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sent: { label: 'Awaiting Signature', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    accepted: { label: 'Signed', cls: 'bg-green-50 text-green-700 border border-green-200' },
    expired: { label: 'Expired', cls: 'bg-red-50 text-red-700 border border-red-200' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-600 border border-gray-200' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function ExpiryBadge({ expiresAt, status }: { expiresAt: string; status: string }) {
  if (status !== 'sent') return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return <span className="text-xs text-red-600 font-medium">Expired</span>;
  if (days <= 7) return <span className="text-xs text-orange-600 font-medium">{days}d left ⚠️</span>;
  return <span className="text-xs text-gray-400">{days}d left</span>;
}

export default function FirmDashboard() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<FirmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [followUpLoading, setFollowUpLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'signed' | 'clearance'>('all');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/onboarding/firms/${slug}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const sendFollowUp = async (token: string, type: 'client' | 'clearance') => {
    setFollowUpLoading(token + type);
    try {
      const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, type }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(`Follow-up #${json.followUpNumber} sent successfully.`);
        load();
      } else {
        alert(json.error || 'Failed to send follow-up');
      }
    } finally {
      setFollowUpLoading(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Loading dashboard…</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-red-500">Failed to load firm data.</p>
    </div>
  );

  const { firm, stats, links } = data;
  const accent = firm.accentColor;

  const filteredLinks = links.filter((l) => {
    if (activeTab === 'pending') return l.status === 'sent';
    if (activeTab === 'signed') return l.status === 'accepted';
    if (activeTab === 'clearance') return l.status === 'accepted' && l.prevAccountantEmail;
    return true;
  });

  const kpis = [
    {
      label: 'Total Onboardings',
      value: stats.total,
      icon: Users,
      sub: `${stats.sent} pending signature`,
      color: accent,
      bg: 'bg-white',
    },
    {
      label: 'Signed & Active',
      value: stats.accepted,
      icon: CheckCircle2,
      sub: `${stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0}% completion rate`,
      color: '#16a34a',
      bg: 'bg-white',
    },
    {
      label: 'Monthly Revenue',
      value: `£${stats.monthlyRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      icon: PoundSterling,
      sub: `£${stats.annualRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })} annually`,
      color: '#0891b2',
      bg: 'bg-white',
    },
    {
      label: 'Action Required',
      value: stats.expiringWithin7Days + stats.pendingClearance,
      icon: AlertTriangle,
      sub: `${stats.expiringWithin7Days} expiring · ${stats.pendingClearance} clearances`,
      color: '#d97706',
      bg: 'bg-white',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/staff')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                <ArrowLeft size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: `linear-gradient(135deg, ${accent}, #1e3a8a)` }}>
                  {firm.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{firm.name}</h1>
                  <p className="text-xs text-gray-500">{firm.partnerName} · {firm.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <RefreshCw size={14} />
                Refresh
              </button>
              <Link
                href={`/onboarding?firm=${slug}`}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white font-semibold rounded-lg transition-all hover:shadow-md"
                style={{ background: `linear-gradient(135deg, ${accent}, #1e3a8a)` }}
              >
                <Plus size={14} />
                New Onboarding
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className={`${kpi.bg} rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: kpi.color + '18' }}>
                    <Icon size={18} style={{ color: kpi.color }} />
                  </div>
                  <ArrowUpRight size={14} className="text-gray-300" />
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-1" style={{ color: typeof kpi.value === 'string' ? kpi.color : 'inherit' }}>
                  {kpi.value}
                </p>
                <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Pipeline bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Onboarding Pipeline</h2>
            <span className="text-xs text-gray-400">{stats.total} total</span>
          </div>
          {stats.total > 0 ? (
            <div className="space-y-3">
              {[
                { label: 'Awaiting Signature', count: stats.sent, color: '#f59e0b', pct: (stats.sent / stats.total) * 100 },
                { label: 'Signed & Active', count: stats.accepted, color: '#16a34a', pct: (stats.accepted / stats.total) * 100 },
                { label: 'Expired / Lapsed', count: stats.expired, color: '#ef4444', pct: (stats.expired / stats.total) * 100 },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-36 text-xs text-gray-500 flex-shrink-0">{row.label}</div>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${row.pct}%`, background: row.color }} />
                  </div>
                  <div className="w-8 text-xs font-semibold text-right" style={{ color: row.color }}>{row.count}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No onboardings yet — start your first one above.</p>
          )}
        </div>

        {/* Onboardings Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-6 pt-5">
            {([
              { key: 'all', label: 'All' },
              { key: 'pending', label: `Pending (${stats.sent})` },
              { key: 'signed', label: `Signed (${stats.accepted})` },
              { key: 'clearance', label: `Clearance Needed` },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`mr-6 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-current text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
                style={activeTab === tab.key ? { borderColor: accent, color: accent } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredLinks.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="mx-auto text-gray-200 mb-3" size={40} />
              <p className="text-sm text-gray-400">No onboardings in this category.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Director / Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Expiry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenue</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Clearance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLinks.map((l) => {
                    const monthly = (l.services ?? []).reduce((s, sv) => s + sv.price, 0);
                    return (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-900">{l.companyName || '—'}</p>
                          <p className="text-xs text-gray-400 font-mono">{l.companyNumber || '—'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-700">{l.directorName || '—'}</p>
                          <p className="text-xs text-gray-400">{l.clientEmail}</p>
                        </td>
                        <td className="px-4 py-4"><StatusBadge status={l.status} /></td>
                        <td className="px-4 py-4">
                          <ExpiryBadge expiresAt={l.expiresAt} status={l.status} />
                          {l.acceptedAt && (
                            <p className="text-xs text-gray-400">
                              Signed {new Date(l.acceptedAt).toLocaleDateString('en-GB')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {monthly > 0 ? (
                            <>
                              <p className="text-sm font-semibold text-gray-900">£{monthly.toFixed(2)}/mo</p>
                              <p className="text-xs text-gray-400">£{(monthly * 12).toFixed(0)}/yr</p>
                            </>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-4">
                          {l.prevAccountantEmail ? (
                            <div>
                              <p className="text-xs text-gray-600">{l.prevAccountantFirmName || 'Prev. accountant'}</p>
                              <p className="text-xs text-gray-400">{l.prevAccountantFollowUpCount} follow-up{l.prevAccountantFollowUpCount !== 1 ? 's' : ''} sent</p>
                            </div>
                          ) : l.status === 'accepted' ? (
                            <span className="text-xs text-green-600 font-medium">New business</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            {l.status === 'sent' && (
                              <button
                                onClick={() => sendFollowUp(l.token, 'client')}
                                disabled={followUpLoading === l.token + 'client'}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                                title="Send reminder to client"
                              >
                                <Send size={11} />
                                {l.clientFollowUpCount > 0 ? `Remind (${l.clientFollowUpCount})` : 'Remind'}
                              </button>
                            )}
                            {l.status === 'accepted' && l.prevAccountantEmail && (
                              <button
                                onClick={() => sendFollowUp(l.token, 'clearance')}
                                disabled={followUpLoading === l.token + 'clearance'}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50"
                                title="Chase previous accountant for clearance"
                              >
                                <Bell size={11} />
                                {l.prevAccountantFollowUpCount > 0 ? `Chase (${l.prevAccountantFollowUpCount})` : 'Chase'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alerts */}
        {(stats.expiringWithin7Days > 0 || stats.pendingClearance > 0) && (
          <div className="grid md:grid-cols-2 gap-5">
            {stats.expiringWithin7Days > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <Clock className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      {stats.expiringWithin7Days} engagement link{stats.expiringWithin7Days !== 1 ? 's' : ''} expiring within 7 days
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Switch to the "Pending" tab and send reminders before they expire.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {stats.pendingClearance > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <Mail className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-orange-900">
                      {stats.pendingClearance} outstanding professional clearance{stats.pendingClearance !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      Switch to "Clearance Needed" tab to chase previous accountants.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
