'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, UserSearch, Filter, Phone, Mail } from 'lucide-react';

interface LinkRow {
  id: string;
  token: string;
  companyName: string | null;
  companyNumber: string | null;
  directorName: string | null;
  clientEmail: string;
  firmSlug: string | null;
  status: string;
  acceptedAt: string | null;
  prevAccountantFirmName: string | null;
  prevAccountantEmail: string | null;
  prevAccountantPhone: string | null;
}

const FIRM_LABELS: Record<string, { label: string; color: string }> = {
  gns:    { label: 'GNS Ltd',    color: '#cc2229' },
  llp:    { label: 'GNS LLP',    color: '#1e3a8a' },
  galaxy: { label: 'Galaxy',     color: '#7c3aed' },
};

export default function AccountantsPage() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [firmFilter, setFirmFilter] = useState('all');

  useEffect(() => {
    fetch('/api/onboarding/links/list')
      .then((r) => r.json())
      .then((data: LinkRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  // Only clients who have provided previous accountant details
  const withAccountant = rows.filter((r) => r.prevAccountantFirmName || r.prevAccountantEmail);
  const filtered = firmFilter === 'all' ? withAccountant : withAccountant.filter((r) => r.firmSlug === firmFilter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Previous Accountants</h1>
          <p className="text-sm text-gray-500 mt-1">
            Previous accountant details provided by clients at signing — the register behind professional clearance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={firmFilter} onChange={(e) => setFirmFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
            <option value="all">All Firms</option>
            {Object.entries(FIRM_LABELS).map(([slug, { label }]) => <option key={slug} value={slug}>{label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-purple-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserSearch size={24} className="text-purple-500" />
          </div>
          <p className="text-gray-900 font-semibold">No previous accountant details yet</p>
          <p className="text-sm text-gray-500 mt-1">Details appear here as clients sign or submit the details form.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['Client / Company', 'Director', 'Our Firm', 'Previous Accountant Firm', 'Email', 'Phone', 'Provided'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const firm = r.firmSlug ? FIRM_LABELS[r.firmSlug] : null;
                  return (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{r.companyName ?? '—'}</p>
                        {r.companyNumber && <p className="text-xs text-gray-400 font-mono">{r.companyNumber}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-800">{r.directorName ?? '—'}</p>
                        <p className="text-xs text-gray-400">{r.clientEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        {firm ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${firm.color}18`, color: firm.color }}>
                            {firm.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.prevAccountantFirmName ?? '—'}</td>
                      <td className="px-4 py-3">
                        {r.prevAccountantEmail ? (
                          <a href={`mailto:${r.prevAccountantEmail}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                            <Mail size={12} /> {r.prevAccountantEmail}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.prevAccountantPhone ? (
                          <span className="flex items-center gap-1 text-gray-700"><Phone size={12} /> {r.prevAccountantPhone}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {r.acceptedAt ? new Date(r.acceptedAt).toLocaleDateString('en-GB') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''} ·{' '}
            <Link href="/staff/clearance" className="text-blue-600 hover:underline">Open Professional Clearance tracker →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
