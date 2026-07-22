'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, ClipboardCheck, CheckCircle2, Clock, ArrowRight, FileSignature } from 'lucide-react';

interface LinkRow {
  id: string; token: string; companyName: string | null; companyNumber: string | null;
  directorName: string | null; clientEmail: string; firmSlug: string | null; status: string;
  acceptedAt: string | null; sendMode: string; hasSignedLetter: boolean;
  prevAccountantEmail: string | null;
  services: Array<{ name: string; price: number; oneoff?: boolean }>;
}

const FIRMS: Record<string, { label: string; color: string }> = {
  gns: { label: 'GNS Ltd', color: '#cc2229' }, llp: { label: 'GNS LLP', color: '#1e3a8a' }, galaxy: { label: 'Galaxy', color: '#7c3aed' },
};

export default function ReviewsPage() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/onboarding/links/list').then((r) => r.json())
      .then((d: LinkRow[]) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  // New signings awaiting the firm's internal review / work setup
  const signed = rows.filter((r) => r.status === 'accepted');
  const awaitingSign = rows.filter((r) => r.status === 'sent');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Engagement Reviews</h1>
        <p className="text-sm text-gray-500 mt-1">Newly signed engagements to review and set up, and letters still awaiting signature.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Signed — to review', value: signed.length, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Awaiting signature', value: awaitingSign.length, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Monthly recurring (signed)', value: `£${signed.reduce((t, r) => t + (r.services || []).filter((s) => !s.oneoff).reduce((a, s) => a + s.price, 0), 0)}`, color: 'text-gray-900', bg: 'bg-gray-50' },
        ].map((c) => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw size={22} className="animate-spin text-purple-500" /></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <ClipboardCheck size={16} className="text-green-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Signed engagements — ready for review &amp; work setup</h2>
          </div>
          {signed.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500 text-center">No signed engagements yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {signed.map((r) => {
                const firm = r.firmSlug ? FIRMS[r.firmSlug] : null;
                return (
                  <Link key={r.id} href={`/staff/clients/${r.token}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-gray-50 group">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 group-hover:text-blue-700">{r.companyName}</p>
                        {firm && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${firm.color}18`, color: firm.color }}>{firm.label}</span>}
                        {r.hasSignedLetter && <span className="flex items-center gap-1 text-xs text-green-700"><FileSignature size={11} /> signed copy</span>}
                      </div>
                      <p className="text-sm text-gray-500">{r.directorName} · {r.clientEmail}{r.acceptedAt && ` · signed ${new Date(r.acceptedAt).toLocaleDateString('en-GB')}`}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="flex items-center gap-1 text-green-700"><CheckCircle2 size={11} /> Letter signed</span>
                        <span className={`flex items-center gap-1 ${r.prevAccountantEmail ? 'text-amber-600' : 'text-gray-400'}`}>
                          <Clock size={11} /> {r.prevAccountantEmail ? 'Clearance in progress' : 'No previous accountant'}
                        </span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
