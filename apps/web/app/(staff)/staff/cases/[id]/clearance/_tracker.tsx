'use client';
import { useState, useTransition } from 'react';
import { CheckCircle2, Clock, Minus, Send, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DocItem {
  id: string;          // e.g. "ct-2024-25"
  type: string;        // "CT" | "AA" | "PAYE" | "VAT" | "SA" | "CIS" | "PAYROLL" | "REFS"
  label: string;       // "Corporation Tax"
  year: string;        // "2024/25"
  status: 'pending' | 'received' | 'na';
  receivedDate: string | null;
  notes: string;
}

export interface ClearanceRequest {
  id: string;
  prevFirmName: string;
  prevFirmEmail: string | null;
  status: string;
  sentAt: string | null;
  nextChaseAt: string | null;
  followupCount: number;
  docItems: DocItem[];
  outcome: string | null;
}

interface Props {
  caseId: string;
  entityId: string;
  clientName: string;
  companyNumber: string;
  request: ClearanceRequest | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { type: 'CT',      label: 'Corporation Tax',      desc: 'CT600 returns and computations' },
  { type: 'AA',      label: 'Annual Accounts',       desc: 'Statutory accounts filed at CH' },
  { type: 'PAYE',    label: 'PAYE / NIC',            desc: 'Payroll, P60s, RTI filings' },
  { type: 'VAT',     label: 'VAT Returns',           desc: 'VAT returns and workings' },
  { type: 'SA',      label: 'Self Assessment',       desc: "Director's personal tax returns" },
  { type: 'CIS',     label: 'CIS Returns',           desc: 'Construction Industry Scheme' },
  { type: 'PAYROLL', label: 'Payroll Records',       desc: 'Full payroll history + P11D' },
  { type: 'REFS',    label: 'HMRC References',       desc: 'UTR, PAYE ref, CH auth code' },
];

function taxYears(n = 3): string[] {
  // Current tax year ends April 5. As of June, current year is active.
  const now = new Date();
  const calYear = now.getFullYear();
  const taxYearEnd = calYear; // e.g. 2025/26 means it ends Apr 2026
  return Array.from({ length: n }, (_, i) => {
    const end = taxYearEnd - i;
    return `${end - 1}/${String(end).slice(-2)}`;
  });
}

const YEARS = taxYears(3);

// ─── Send Form ────────────────────────────────────────────────────────────────

function SendForm({ caseId, entityId, clientName, companyNumber }: Omit<Props, 'request'>) {
  const [firmName, setFirmName] = useState('');
  const [firmEmail, setFirmEmail] = useState('');
  const [firmAddress, setFirmAddress] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['CT', 'AA', 'PAYE', 'VAT', 'REFS']);
  const [yearCount, setYearCount] = useState(3);
  const [deadline, setDeadline] = useState(14);
  const [sending, startSend] = useTransition();
  const [error, setError] = useState('');

  const toggleType = (t: string) =>
    setSelectedTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const handleSend = () => {
    if (!firmName || !firmEmail) { setError('Previous firm name and email are required.'); return; }
    setError('');

    const years = taxYears(yearCount);
    const docItems: DocItem[] = selectedTypes.flatMap(type =>
      DOC_TYPES.find(d => d.type === type && type !== 'REFS')
        ? years.map(year => ({
            id: `${type.toLowerCase()}-${year.replace('/', '-')}`,
            type, year,
            label: DOC_TYPES.find(d => d.type === type)!.label,
            status: 'pending' as const,
            receivedDate: null,
            notes: '',
          }))
        : selectedTypes.includes('REFS')
          ? []
          : []
    );
    // REFS is a single non-year item
    if (selectedTypes.includes('REFS')) {
      docItems.push({
        id: 'refs-all', type: 'REFS', year: 'All',
        label: 'HMRC References', status: 'pending', receivedDate: null, notes: '',
      });
    }

    startSend(async () => {
      const res = await fetch(`/api/clearance/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId, entityId, clientName, companyNumber,
          prevFirmName: firmName, prevFirmEmail: firmEmail,
          prevFirmAddress: firmAddress,
          responseDeadlineDays: deadline,
          docItems,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to send'); return; }
      window.location.reload();
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">Send Professional Clearance Request</h2>
        <p className="text-xs text-gray-500 mt-0.5">Per ICAEW Code of Ethics R320.7 — sent to previous accountant</p>
      </div>

      <div className="p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Prev firm details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Previous Firm Name *</label>
            <input value={firmName} onChange={e => setFirmName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Smith & Co Accountants" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Previous Firm Email *</label>
            <input type="email" value={firmEmail} onChange={e => setFirmEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="accounts@previousfirm.co.uk" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Response Deadline (days)</label>
            <input type="number" value={deadline} onChange={e => setDeadline(Number(e.target.value))}
              min={7} max={30}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Previous Firm Address</label>
            <textarea value={firmAddress} onChange={e => setFirmAddress(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123 High Street, London, EC1A 1BB" />
          </div>
        </div>

        {/* Year range */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Number of Tax Years to Request</label>
          <div className="flex gap-2">
            {[1, 2, 3].map(n => (
              <button key={n} type="button" onClick={() => setYearCount(n)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${yearCount === n ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                {n} {n === 1 ? 'Year' : 'Years'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Will request: {taxYears(yearCount).join(', ')}</p>
        </div>

        {/* Document types */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Documents to Request</label>
          <div className="grid grid-cols-2 gap-2">
            {DOC_TYPES.map(d => (
              <button key={d.type} type="button" onClick={() => toggleType(d.type)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selectedTypes.includes(d.type) ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${selectedTypes.includes(d.type) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {selectedTypes.includes(d.type) && <svg width="10" height="8" viewBox="0 0 10 8" fill="white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{d.label}</p>
                  <p className="text-xs text-gray-400">{d.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleSend} disabled={sending}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 transition-all">
          {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
          {sending ? 'Sending…' : 'Send Clearance Request'}
        </button>
      </div>
    </div>
  );
}

// ─── Status cell ─────────────────────────────────────────────────────────────

function StatusCell({ item, requestId, onChange }: {
  item: DocItem;
  requestId: string;
  onChange: (updated: DocItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [localNotes, setLocalNotes] = useState(item.notes);
  const [localDate, setLocalDate] = useState(item.receivedDate ?? new Date().toISOString().split('T')[0]);

  const save = (status: DocItem['status'], date: string | null, notes: string) => {
    startSave(async () => {
      await fetch(`/api/clearance/requests/${requestId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, status, receivedDate: date, notes }),
      });
      onChange({ ...item, status, receivedDate: date, notes });
      setOpen(false);
    });
  };

  if (item.status === 'na') return (
    <td className="px-3 py-3 text-center">
      <button onClick={() => save('pending', null, item.notes)}
        className="text-gray-300 hover:text-gray-500 transition-colors text-lg">—</button>
    </td>
  );

  return (
    <td className="px-3 py-3 text-center relative">
      <button onClick={() => setOpen(!open)} disabled={saving}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
          item.status === 'received'
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
        }`}>
        {saving ? <RefreshCw size={10} className="animate-spin" /> :
          item.status === 'received' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
        {item.status === 'received' ? 'Received' : 'Pending'}
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {open && (
        <div className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-52 text-left">
          <p className="text-xs font-bold text-gray-700 mb-2">{item.label} {item.year}</p>

          {item.status !== 'received' ? (
            <>
              <label className="text-xs text-gray-500 mb-1 block">Received date</label>
              <input type="date" value={localDate} onChange={e => setLocalDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-green-400" />
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <textarea value={localNotes} onChange={e => setLocalNotes(e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-green-400"
                placeholder="e.g. Received via email" />
              <div className="flex gap-1.5">
                <button onClick={() => save('received', localDate, localNotes)}
                  className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700">
                  Mark Received
                </button>
                <button onClick={() => save('na', null, localNotes)}
                  className="px-2 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50">
                  N/A
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-green-700 mb-1">
                Received: {item.receivedDate ? new Date(item.receivedDate).toLocaleDateString('en-GB') : '—'}
              </p>
              {item.notes && <p className="text-xs text-gray-500 mb-2">{item.notes}</p>}
              <button onClick={() => save('pending', null, item.notes)}
                className="w-full py-1.5 border border-gray-200 text-amber-600 rounded-lg text-xs font-semibold hover:bg-amber-50">
                Mark as Pending
              </button>
            </>
          )}
        </div>
      )}
    </td>
  );
}

// ─── Tracking Matrix ──────────────────────────────────────────────────────────

function TrackingMatrix({ request, caseId, entityId }: { request: ClearanceRequest; caseId: string; entityId: string }) {
  const [items, setItems] = useState<DocItem[]>(request.docItems);
  const [chasing, startChase] = useTransition();
  const [chaseMsg, setChaseMsg] = useState('');

  const updateItem = (updated: DocItem) =>
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));

  const pending = items.filter(i => i.status === 'pending');
  const received = items.filter(i => i.status === 'received');
  const allDone = pending.length === 0;

  // Group by doc type for display
  const typeGroups = DOC_TYPES.filter(d => items.some(i => i.type === d.type));
  const years = [...new Set(items.filter(i => i.year !== 'All').map(i => i.year))].sort().reverse();

  const sendChase = () => {
    startChase(async () => {
      const res = await fetch(`/api/clearance/requests/${request.id}/chase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, entityId }),
      });
      const data = await res.json() as { message?: string; error?: string };
      setChaseMsg(data.message ?? data.error ?? 'Done');
      setTimeout(() => setChaseMsg(''), 4000);
    });
  };

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                request.status === 'received' ? 'bg-green-100 text-green-700' :
                request.status === 'chased' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>{request.status.replace('_', ' ').toUpperCase()}</span>
              {request.followupCount > 0 && (
                <span className="text-xs text-gray-400">{request.followupCount} chase{request.followupCount !== 1 ? 's' : ''} sent</span>
              )}
            </div>
            <p className="font-bold text-gray-900">{request.prevFirmName}</p>
            {request.prevFirmEmail && <p className="text-sm text-gray-500">{request.prevFirmEmail}</p>}
          </div>
          <div className="text-right text-xs text-gray-400 flex-shrink-0">
            {request.sentAt && <p>Sent: {new Date(request.sentAt).toLocaleDateString('en-GB')}</p>}
            {request.nextChaseAt && !allDone && (
              <p className="text-amber-600">Next auto-chase: {new Date(request.nextChaseAt).toLocaleDateString('en-GB')}</p>
            )}
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-green-700">
            <CheckCircle2 size={14} /> <span className="font-semibold">{received.length} received</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-600">
            <Clock size={14} /> <span className="font-semibold">{pending.length} outstanding</span>
          </div>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden ml-2">
            <div className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${items.length > 0 ? (received.length / items.length) * 100 : 0}%` }} />
          </div>
        </div>

        {allDone && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700 font-semibold flex items-center gap-2">
            <CheckCircle2 size={15} /> All documents received — clearance complete
          </div>
        )}
      </div>

      {/* Document matrix */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Document Tracking</h3>
          <div className="flex items-center gap-2">
            {chaseMsg && <span className="text-xs text-blue-600">{chaseMsg}</span>}
            {!allDone && (
              <button onClick={sendChase} disabled={chasing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-60 transition-all">
                {chasing ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                {chasing ? 'Sending…' : 'Send Chase'}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-40">Document</th>
                {years.map(y => (
                  <th key={y} className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-center">{y}</th>
                ))}
                {items.some(i => i.year === 'All') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-center">Status</th>
                )}
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-left w-40">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {typeGroups.map(({ type, label }) => {
                const typeItems = items.filter(i => i.type === type);
                const rowItems = years.map(y => typeItems.find(i => i.year === y) ?? null);
                const refsItem = typeItems.find(i => i.year === 'All');
                const anyNote = typeItems.find(i => i.notes);

                return (
                  <tr key={type} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-semibold text-gray-800 text-sm">{label}</td>
                    {years.map((y, yi) => {
                      const item = rowItems[yi];
                      if (!item) return <td key={y} className="px-3 py-3 text-center text-gray-200">—</td>;
                      return (
                        <StatusCell key={y} item={item} requestId={request.id}
                          onChange={updateItem} />
                      );
                    })}
                    {refsItem && (
                      <StatusCell item={refsItem} requestId={request.id} onChange={updateItem} />
                    )}
                    <td className="px-3 py-3 text-xs text-gray-400">
                      {anyNote?.notes || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ClearanceTracker({ caseId, entityId, clientName, companyNumber, request }: Props) {
  if (!request) {
    return <SendForm caseId={caseId} entityId={entityId} clientName={clientName} companyNumber={companyNumber} />;
  }
  return <TrackingMatrix request={request} caseId={caseId} entityId={entityId} />;
}
