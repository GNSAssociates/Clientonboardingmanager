'use client';
import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { Mail, RotateCcw, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface OnboardingStats {
  firm: string;
  total: number;
  sent: number;
  accepted: number;
  expired: number;
  links: Array<{
    id: string;
    companyName: string;
    clientEmail: string;
    status: 'sent' | 'accepted' | 'expired';
    expiresAt: string;
    createdAt: string;
    resendCount: string;
  }>;
}

export default function OnboardingDashboard() {
  const session = getSession();
  if (!session) return notFound();

  const [stats, setStats] = useState<OnboardingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'accepted' | 'expired'>('all');
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/onboarding/dashboard');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleResend = async (linkId: string) => {
    setResending(linkId);
    try {
      const res = await fetch(`/api/onboarding/links/${linkId}/resend`, {
        method: 'POST',
      });
      if (res.ok) {
        // Refresh stats
        const statsRes = await fetch('/api/onboarding/dashboard');
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
      }
    } catch (error) {
      console.error('Failed to resend:', error);
    } finally {
      setResending(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <p className="text-gray-600">Failed to load onboarding dashboard</p>
      </div>
    );
  }

  const filteredLinks =
    filter === 'all'
      ? stats.links
      : stats.links.filter((l) => l.status === filter);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Onboarding Dashboard</h1>
        <p className="text-gray-600 mt-1">{stats.firm} — Client acquisition overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-600">Total Links Sent</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-lg p-6">
          <p className="text-sm text-gray-600">Pending Response</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.sent}</p>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-6">
          <p className="text-sm text-gray-600">Accepted</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.accepted}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <p className="text-sm text-gray-600">Expired</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{stats.expired}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b">
        {(['all', 'sent', 'accepted', 'expired'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              filter === f
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {f === 'all' ? 'All' : f === 'sent' ? 'Pending' : f === 'accepted' ? 'Accepted' : 'Expired'}
          </button>
        ))}
      </div>

      {/* Links table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Company</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Expires</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Resends</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLinks.map((link) => {
              const expiresAt = new Date(link.expiresAt);
              const daysLeft = Math.ceil(
                (expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <tr key={link.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {link.companyName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{link.clientEmail}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        link.status === 'sent'
                          ? 'bg-blue-100 text-blue-700'
                          : link.status === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {link.status === 'sent' && <Clock size={14} />}
                      {link.status === 'accepted' && <CheckCircle2 size={14} />}
                      {link.status === 'expired' && <AlertCircle size={14} />}
                      {link.status === 'sent' ? 'Pending' : link.status === 'accepted' ? 'Accepted' : 'Expired'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {daysLeft > 0 ? `${daysLeft}d` : 'Expired'}
                    {daysLeft > 0 && daysLeft <= 7 && (
                      <span className="ml-2 text-red-600 font-medium">⚠️</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{link.resendCount}</td>
                  <td className="px-6 py-4 text-right">
                    {link.status === 'sent' && daysLeft > 0 && (
                      <button
                        onClick={() => handleResend(link.id)}
                        disabled={resending === link.id}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                      >
                        <RotateCcw size={14} />
                        {resending === link.id ? 'Resending...' : 'Resend'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredLinks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No {filter !== 'all' ? filter : ''} onboarding links found.
          </div>
        )}
      </div>
    </div>
  );
}
