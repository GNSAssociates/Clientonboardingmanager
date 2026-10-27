'use client';

/**
 * The handover work list, on the front page.
 *
 * One line per client: how much is outstanding, who is holding it, and a click
 * through to the checklist. Grouped by client because that is how chasing
 * actually happens — one call to a previous accountant covers everything they
 * hold, not one call per item.
 *
 * It says nothing when there is nothing outstanding. A panel that always shows
 * something teaches people to stop reading it.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ClientRow {
  linkToken: string;
  companyName: string | null;
  total: number;
  fromPreviousAccountant: number;
  fromClient: number;
  examples: Array<{ label: string; source: string | null; periodTo: string | null; note: string | null }>;
}

const ukDate = (iso: string | null) =>
  iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

export default function OutstandingHandovers() {
  const [data, setData] = useState<{ totalOutstanding: number; clients: ClientRow[]; sources: Record<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/handover/outstanding')
      .then((r) => r.json())
      .then((j) => (j.error ? setFailed(true) : setData(j)))
      .catch(() => setFailed(true));
  }, []);

  // Nothing to say is said by saying nothing.
  if (failed || !data || !data.clients.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Onboarding — waiting on someone</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {data.totalOutstanding} item{data.totalOutstanding === 1 ? '' : 's'} across {data.clients.length} client{data.clients.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {data.clients.map((c) => (
          <Link
            key={c.linkToken}
            href={`/staff/handover/${c.linkToken}`}
            className="flex items-start gap-4 py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
          >
            <span className="text-xl font-bold text-amber-700 w-10 text-right tabular-nums">{c.total}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-900">{c.companyName ?? 'Unnamed engagement'}</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {c.fromPreviousAccountant > 0 && <>{c.fromPreviousAccountant} from the previous accountant</>}
                {c.fromPreviousAccountant > 0 && c.fromClient > 0 && ' · '}
                {c.fromClient > 0 && <>{c.fromClient} from the client</>}
              </span>
              <span className="block text-xs text-gray-400 mt-1">
                {c.examples.map((e) => e.label + (e.periodTo ? ` (to ${ukDate(e.periodTo)})` : '')).join(' · ')}
              </span>
            </span>
            <span className="text-gray-300 text-sm">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
