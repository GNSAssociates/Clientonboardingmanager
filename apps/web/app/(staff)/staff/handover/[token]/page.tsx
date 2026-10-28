'use client';

/**
 * The handover checklist, as a working screen.
 *
 * Built so that a member of staff can run a handover without asking a partner
 * what is needed or which period it covers. Each line says what it is, who
 * holds it, the dates it has to cover and why, and takes a status and a note.
 * Items that do not apply are shown greyed with the reason, not hidden — so
 * nobody wonders whether the question was asked and dismissed, or never asked.
 */

import { useCallback, useEffect, useState } from 'react';
import { StatusPicker, HANDOVER_STATUS_OPTIONS } from '@/components/status-picker';

type Status = 'pending' | 'received' | 'verified' | 'na';

interface Item {
  id: string; key: string; label: string; category: string;
  status: Status; source: string | null; note: string | null;
  naReason: string | null; hint: string | null;
  periodFrom: string | null; periodTo: string | null; periodWhy: string | null;
  assignedTo: string | null; ownerId: string | null; partnerId: string | null;
}

interface Payload {
  companyName: string | null;
  companyNumber: string | null;
  companiesHouse?: {
    name: string | null; status: string | null; incorporatedOn: string | null;
    hasFilingHistory: boolean | null; lastAccountsTo: string | null; error: string | null;
  } | null;
  items: Item[];
  categories: Record<string, string>;
  sources: Record<string, string>;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending', received: 'Received', verified: 'Verified', na: 'Not applicable',
};
// The boxes themselves live in components/status-picker, so the handover and
// clearance screens cannot drift into looking like two different products.

const ukDate = (iso: string | null) =>
  iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';

export default function HandoverPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch(`/api/handover/${params.token}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.detail || j.error) : setData(j)))
      .catch(() => setError('Could not load the checklist.'));
  }, [params.token]);

  useEffect(load, [load]);

  const save = async (item: Item, patch: Partial<Pick<Item, 'status' | 'note'>>) => {
    setSaving((s) => ({ ...s, [item.id]: 'saving…' }));
    setData((d) => d && { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) });
    try {
      const res = await fetch(`/api/handover/item/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      setSaving((s) => ({ ...s, [item.id]: res.ok ? 'saved' : 'could not save' }));
    } catch {
      setSaving((s) => ({ ...s, [item.id]: 'could not save' }));
    }
    setTimeout(() => setSaving((s) => ({ ...s, [item.id]: '' })), 2500);
  };

  if (error) return <div className="p-8 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-sm text-gray-500">Loading the handover checklist…</div>;

  const outstanding = data.items.filter((i) => i.status === 'pending');
  const fromPrevious = outstanding.filter((i) => i.source === 'previous_accountant');
  const byCategory = Object.keys(data.categories).filter((c) => data.items.some((i) => i.category === c));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{data.companyName ?? 'Handover'}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.companyNumber ? `Company ${data.companyNumber} · ` : ''}
          {outstanding.length} outstanding, {fromPrevious.length} of them from the previous accountant
        </p>

        {/* What Companies House already told us, so nobody looks it up again. */}
        {data.companiesHouse && !data.companiesHouse.error && (
          <p className="text-xs text-gray-500 mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            Companies House: {data.companiesHouse.status ?? 'status unknown'}
            {data.companiesHouse.incorporatedOn && ` · incorporated ${ukDate(String(data.companiesHouse.incorporatedOn).slice(0, 10))}`}
            {data.companiesHouse.hasFilingHistory === false && ' · nothing filed yet, so there is no CT600 to ask for'}
            {data.companiesHouse.lastAccountsTo && ` · last accounts to ${ukDate(String(data.companiesHouse.lastAccountsTo).slice(0, 10))}`}
          </p>
        )}
        {data.companiesHouse?.error && (
          <p className="text-xs text-amber-700 mt-2">Companies House could not be checked ({data.companiesHouse.error}) — confirm the prior-year items by hand.</p>
        )}
      </header>

      {byCategory.map((cat) => (
        <section key={cat} className="border border-gray-200 rounded-xl overflow-hidden">
          <h2 className="text-sm font-semibold bg-gray-50 px-4 py-2 border-b border-gray-200">
            {data.categories[cat]}
          </h2>
          <div className="divide-y divide-gray-100">
            {data.items.filter((i) => i.category === cat).map((item) => (
              <div key={item.id} className={`px-4 py-3 ${item.status === 'na' ? 'bg-gray-50/60' : ''}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>

                    <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                      {item.source && <span>from: <b className="font-medium">{data.sources[item.source] ?? item.source}</b></span>}
                      {item.periodTo && (
                        <span>
                          · covering {item.periodFrom ? `${ukDate(item.periodFrom)} to ` : 'to '}{ukDate(item.periodTo)}
                        </span>
                      )}
                    </div>

                    {item.periodWhy && <div className="text-xs text-gray-400 mt-0.5">{item.periodWhy}</div>}
                    {item.hint && <div className="text-xs text-gray-500 mt-1 italic">{item.hint}</div>}
                    {item.status === 'na' && item.naReason && (
                      <div className="text-xs text-gray-500 mt-1">Not applicable — {item.naReason}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPicker
                      value={item.status}
                      options={HANDOVER_STATUS_OPTIONS}
                      busy={saving[item.id] === 'saving…'}
                      onPick={(s) => save(item, { status: s })}
                    />
                    <span className="text-[11px] text-gray-400 w-16">{saving[item.id] ?? ''}</span>
                  </div>
                </div>

                {/* The note: why it is part-pending, what is missing, who said what. */}
                <input
                  defaultValue={item.note ?? ''}
                  placeholder="Note — e.g. part pending, NI figures missing for two employees"
                  onBlur={(e) => { if (e.target.value !== (item.note ?? '')) save(item, { note: e.target.value || null }); }}
                  className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
