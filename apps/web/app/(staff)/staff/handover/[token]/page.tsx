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
    <div className="max-w-7xl mx-auto px-5 py-5 space-y-4">
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
          <h2 className="text-sm font-semibold bg-gray-50 px-4 py-1.5 border-b border-gray-200">
            {data.categories[cat]}
          </h2>
          {/* Two columns on a wide screen. Twenty-four items in one column is
              four screens of scrolling to answer "what are we waiting for". */}
          <div className="grid xl:grid-cols-2 xl:divide-x divide-gray-100">
            {data.items.filter((i) => i.category === cat).map((item) => (
              <div key={item.id} className={`px-3 py-1.5 border-b border-gray-100 ${item.status === 'na' ? 'bg-gray-50/60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 leading-snug">{item.label}</div>

                    {/* Everything about the item on one line instead of four. */}
                    <div className="text-[11px] text-gray-500 leading-snug">
                      {item.source && <>from <b className="font-medium">{data.sources[item.source] ?? item.source}</b></>}
                      {item.periodTo && (
                        <> · {item.periodFrom ? `${ukDate(item.periodFrom)}–` : 'to '}{ukDate(item.periodTo)}</>
                      )}
                      {item.status === 'na' && item.naReason && <> · N/A — {item.naReason}</>}
                      {(item.hint || item.periodWhy) && (
                        <span title={[item.periodWhy, item.hint].filter(Boolean).join(' — ')}
                              className="ml-1 cursor-help text-gray-400">ⓘ</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusPicker
                      value={item.status}
                      options={HANDOVER_STATUS_OPTIONS}
                      busy={saving[item.id] === 'saving…'}
                      onPick={(s) => save(item, { status: s })}
                    />
                  </div>
                </div>

                {/* The note stays out of the way until it is wanted. A text box
                    on every row doubled the height of the page to show two
                    dozen mostly-empty inputs. */}
                <NoteField
                  value={item.note}
                  saving={saving[item.id]}
                  onSave={(v) => save(item, { note: v })}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * A note, hidden until there is one or somebody wants to write one.
 *
 * Every row used to carry an always-visible text box. Across two dozen items
 * that is two dozen empty inputs and roughly double the page height, to show
 * something that is filled in perhaps three times in a handover.
 */
function NoteField({
  value, saving, onSave,
}: { value: string | null; saving?: string; onSave: (v: string | null) => void }) {
  const [open, setOpen] = useState(Boolean(value));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-0.5 text-[11px] text-gray-400 hover:text-gray-700"
      >
        + note
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <input
        autoFocus={!value}
        defaultValue={value ?? ''}
        placeholder="e.g. part pending, NI figures missing for two employees"
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next !== (value ?? '')) onSave(next || null);
          if (!next) setOpen(false);
        }}
        className="flex-1 text-[11px] border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
      />
      <span className="text-[10px] text-gray-400 w-12 shrink-0">{saving ?? ''}</span>
    </div>
  );
}
