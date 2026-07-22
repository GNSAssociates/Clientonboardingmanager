'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, FileText, Filter, Eye, Download, FileSignature, FileJson } from 'lucide-react';

interface LinkRow {
  id: string;
  token: string;
  companyName: string | null;
  companyNumber: string | null;
  directorName: string | null;
  clientEmail: string;
  firmSlug: string | null;
  status: string;
  sentAt: string | null;
  acceptedAt: string | null;
  sendMode: string;
  partnerName: string | null;
  hasSignedLetter: boolean;
  signatureName: string | null;
}

const FIRM_LABELS: Record<string, { label: string; color: string }> = {
  gns:    { label: 'GNS Ltd', color: '#cc2229' },
  llp:    { label: 'GNS LLP', color: '#1e3a8a' },
  galaxy: { label: 'Galaxy',  color: '#7c3aed' },
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  sent:     { bg: 'bg-blue-50',  text: 'text-blue-700',  label: 'Awaiting signature' },
  accepted: { bg: 'bg-green-50', text: 'text-green-700', label: 'Signed' },
  expired:  { bg: 'bg-gray-100', text: 'text-gray-500',  label: 'Expired' },
};

export default function LettersPage() {
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

  const letters = rows.filter((r) => r.sendMode !== 'details_only');
  const filtered = firmFilter === 'all' ? letters : letters.filter((r) => r.firmSlug === firmFilter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Engagement Letters</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every letter issued — view, download, and export client details. Signed copies include the e-signature certificate.
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
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-blue-500" />
          </div>
          <p className="text-gray-900 font-semibold">No engagement letters yet</p>
          <p className="text-sm text-gray-500 mt-1">Letters appear here as soon as they are issued from the onboarding wizard.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const firm = r.firmSlug ? FIRM_LABELS[r.firmSlug] : null;
            const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.sent!;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                      {firm && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${firm.color}18`, color: firm.color }}>
                          {firm.label}
                        </span>
                      )}
                      {r.partnerName && <span className="text-xs text-gray-400">Partner: {r.partnerName}</span>}
                    </div>
                    <p className="font-bold text-gray-900">
                      {r.companyName}
                      {r.companyNumber && <span className="font-normal text-gray-400 text-sm ml-2">· {r.companyNumber}</span>}
                    </p>
                    <p className="text-sm text-gray-500">
                      {r.directorName} · {r.clientEmail}
                      {r.sentAt && <> · Sent {new Date(r.sentAt).toLocaleDateString('en-GB')}</>}
                      {r.acceptedAt && r.signatureName && <> · Signed by <strong>{r.signatureName}</strong> on {new Date(r.acceptedAt).toLocaleDateString('en-GB')}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                    <a href={`/api/onboarding/links/${r.token}/letter`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-500">
                      <Eye size={13} /> View
                    </a>
                    <a href={`/api/onboarding/links/${r.token}/letter?pdf=1&download=1`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-500">
                      <Download size={13} /> PDF
                    </a>
                    {r.hasSignedLetter && (
                      <a href={`/api/onboarding/links/${r.token}/letter?signed=1&pdf=1&download=1`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700">
                        <FileSignature size={13} /> Signed PDF
                      </a>
                    )}
                    <a href={`/staff/clients/${r.token}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:border-gray-500">
                      <FileJson size={13} /> Client
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
