'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  RefreshCw, ChevronLeft, Send, CheckCircle2, Clock, Mail,
  Pencil, Save, AlertTriangle, Pause, Play,
} from 'lucide-react';

interface DocItem {
  id: string;
  type?: string;
  label: string;
  year?: string;
  status: 'pending' | 'received' | 'na';
  receivedDate?: string | null;
  notes?: string;
}

interface ClearanceDetail {
  id: string;
  prevFirmName: string;
  prevFirmEmail: string | null;
  status: string;
  outcome: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  nextChaseAt: string | null;
  linkToken: string | null;
  entityId: string | null;
  caseId: string | null;
  responseData: {
    companyName?: string;
    companyNumber?: string;
    firmSlug?: string;
    directorName?: string;
    clientEmail?: string;
    prevPhone?: string | null;
    docItems?: DocItem[];
    staffNotes?: string;
    stopChase?: boolean;
  } | null;
}

const FIRM_LABELS: Record<string, { label: string; color: string }> = {
  gns:    { label: 'GNS Associates Limited', color: '#cc2229' },
  llp:    { label: 'GNS Associates UK LLP',  color: '#1e3a8a' },
  galaxy: { label: 'Galaxy Accountants',     color: '#7c3aed' },
};

const ITEM_STATUS: Array<{ value: DocItem['status']; label: string; cls: string }> = [
  { value: 'pending',  label: 'Requested',      cls: 'bg-amber-50 text-amber-700 border-amber-300' },
  { value: 'received', label: 'Received',       cls: 'bg-green-50 text-green-700 border-green-300' },
  { value: 'na',       label: 'Not applicable', cls: 'bg-gray-50 text-gray-500 border-gray-300' },
];

export default function ClearanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [req, setReq] = useState<ClearanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [chasing, setChasing] = useState(false);
  const [savingStop, setSavingStop] = useState(false);
  const [msg, setMsg] = useState('');
  const [editEmail, setEditEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [firmDraft, setFirmDraft] = useState('');

  const load = useCallback(() => {
    fetch(`/api/clearance/requests/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ClearanceDetail | null) => {
        setReq(data);
        if (data) {
          setEmailDraft(data.prevFirmEmail ?? '');
          setFirmDraft(data.prevFirmName ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-32"><RefreshCw size={24} className="animate-spin text-purple-500" /></div>
  );
  if (!req) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <AlertTriangle className="mx-auto text-amber-500 mb-3" size={36} />
      <p className="font-bold text-gray-900">Clearance request not found</p>
      <Link href="/staff/clearance" className="text-sm text-blue-600 hover:underline mt-2 inline-block">← Back to clearance</Link>
    </div>
  );

  const rd = req.responseData ?? {};
  const items = rd.docItems ?? [];
  const received = items.filter((i) => i.status === 'received').length;
  const applicable = items.filter((i) => i.status !== 'na').length;
  const pct = applicable > 0 ? Math.round((received / applicable) * 100) : 0;
  const firm = rd.firmSlug ? FIRM_LABELS[rd.firmSlug] : null;
  const stopChase = !!rd.stopChase;

  const toggleStopChase = async () => {
    setSavingStop(true);
    setMsg('');
    try {
      const res = await fetch(`/api/clearance/requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopChase: !stopChase }),
      });
      if (!res.ok) throw new Error('Save failed');
      load();
    } catch {
      setMsg('Could not update auto-chase setting.');
    } finally {
      setSavingStop(false);
    }
  };

  const setItemStatus = async (item: DocItem, status: DocItem['status']) => {
    setSaving(item.id);
    setMsg('');
    try {
      const res = await fetch(`/api/clearance/requests/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          status,
          receivedDate: status === 'received' ? new Date().toISOString() : null,
          notes: item.notes ?? '',
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      load();
    } catch {
      setMsg('Could not save item — try again.');
    } finally {
      setSaving(null);
    }
  };

  const sendChase = async () => {
    setChasing(true);
    setMsg('');
    try {
      const res = await fetch(`/api/clearance/requests/${id}/chase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: req.caseId ?? '', entityId: req.entityId ?? '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Chase failed');
      setMsg('✅ Follow-up email sent to the previous accountant.');
      load();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Chase failed'}`);
    } finally {
      setChasing(false);
    }
  };

  const saveContact = async () => {
    setMsg('');
    try {
      const res = await fetch(`/api/clearance/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prevFirmEmail: emailDraft, prevFirmName: firmDraft }),
      });
      if (!res.ok) throw new Error();
      setEditEmail(false);
      load();
      setMsg('✅ Previous accountant contact updated.');
    } catch {
      setMsg('❌ Could not update contact.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <button onClick={() => router.push('/staff/clearance')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ChevronLeft size={16} /> All clearance requests
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {firm && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${firm.color}18`, color: firm.color }}>
                  {firm.label}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${req.status === 'received' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                {req.status === 'received' ? 'Complete' : req.status === 'chased' ? 'Chased' : 'Awaiting response'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {rd.companyName ?? 'Client'}
              {rd.companyNumber && <span className="font-normal text-gray-400 text-base ml-2">· {rd.companyNumber}</span>}
            </h1>
            {rd.directorName && <p className="text-sm text-gray-500">Director: {rd.directorName} · {rd.clientEmail}</p>}
            <div className="mt-3 text-sm text-gray-700">
              {!editEmail ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span><strong>Previous accountant:</strong> {req.prevFirmName}</span>
                  {req.prevFirmEmail && <span className="flex items-center gap-1 text-gray-500"><Mail size={13} /> {req.prevFirmEmail}</span>}
                  {rd.prevPhone && <span className="text-gray-500">☎ {rd.prevPhone}</span>}
                  <button onClick={() => setEditEmail(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Pencil size={12} /> Edit
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={firmDraft} onChange={(e) => setFirmDraft(e.target.value)} placeholder="Firm name"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <input value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="email@firm.com" type="email"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <button onClick={saveContact} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold">
                    <Save size={12} /> Save
                  </button>
                  <button onClick={() => setEditEmail(false)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-3 flex-wrap">
              {req.sentAt && <span>Requested {new Date(req.sentAt).toLocaleDateString('en-GB')}</span>}
              {req.nextChaseAt && req.status !== 'received' && (
                <span className="flex items-center gap-1"><Clock size={12} /> Next auto-chase {new Date(req.nextChaseAt).toLocaleDateString('en-GB')}</span>
              )}
              {req.receivedAt && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Completed {new Date(req.receivedAt).toLocaleDateString('en-GB')}</span>}
            </p>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-bold text-gray-900">{received}<span className="text-lg text-gray-400">/{applicable}</span></p>
            <p className="text-xs text-gray-500">documents received</p>
            <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <button onClick={sendChase} disabled={chasing || req.status === 'received'}
              className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                req.status === 'received' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-white hover:opacity-90'
              }`}
              style={req.status === 'received' ? {} : { background: 'linear-gradient(135deg, #cc2229, #1e3a8a)' }}>
              {chasing ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              Follow up now
            </button>
            <button onClick={toggleStopChase} disabled={savingStop}
              className={`mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border ${
                stopChase ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-gray-300 text-gray-600 hover:border-gray-500'
              }`}>
              {savingStop ? <RefreshCw size={12} className="animate-spin" /> : stopChase ? <Play size={12} /> : <Pause size={12} />}
              {stopChase ? 'Resume auto-chase' : 'Stop auto-chase'}
            </button>
          </div>
        </div>
        {stopChase && <p className="text-xs text-amber-700 mt-3">⏸ Auto-chase paused — the previous accountant will not be chased automatically. You can still follow up manually.</p>}
        {msg && <p className="text-sm mt-4 text-gray-700">{msg}</p>}
      </div>

      {/* Requested vs received — tick items off as they arrive */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Requested Documents & Information</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Everything requested in the clearance letter — click a status to update it manually as records arrive
          </p>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">No tracked items on this request.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400">
                    {item.year && <span>{item.year}</span>}
                    {item.status === 'received' && item.receivedDate && (
                      <span className="text-green-600 ml-2">Received {new Date(item.receivedDate).toLocaleDateString('en-GB')}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {ITEM_STATUS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setItemStatus(item, s.value)}
                      disabled={saving === item.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        item.status === s.value ? s.cls : 'border-gray-200 text-gray-400 hover:border-gray-400 bg-white'
                      }`}
                    >
                      {saving === item.id ? '…' : s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
