'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface RoleRow {
  role: string;
  onboarding: boolean;
  invoice: boolean;
  locked: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrator',
  Partner: 'Partner',
  Manager: 'Manager',
  HR: 'Human Resources',
  OnboardingStaff: 'Onboarding Staff',
  Reviewer: 'Reviewer',
  ComplianceOfficer: 'Compliance Officer',
};

const ROLE_HINT: Record<string, string> = {
  Admin: 'Full system owner — always has everything.',
  Partner: 'Firm partner — always has everything.',
  Manager: 'Senior staff who run onboarding.',
  HR: 'People / staff administration.',
  OnboardingStaff: 'Handles client intake tasks.',
  Reviewer: 'Reviews and approves work.',
  ComplianceOfficer: 'AML / compliance oversight.',
};

function Toggle({
  on, disabled, onChange, color,
}: { on: boolean; disabled?: boolean; onChange: () => void; color: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      aria-pressed={on}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
      style={{ background: on ? color : '#d1d5db' }}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function PermissionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<RoleRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/permissions')
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null; }
        if (r.status === 403) { router.push('/dashboard'); return null; }
        if (!r.ok) throw new Error('Could not load permissions');
        return r.json();
      })
      .then((d) => { if (d) setRows(d.roles); })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [router]);

  const setCell = (role: string, key: 'onboarding' | 'invoice', value: boolean) => {
    setRows((prev) =>
      prev ? prev.map((r) => (r.role === role ? { ...r, [key]: value } : r)) : prev,
    );
    setSaved(false);
  };

  const save = async () => {
    if (!rows) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: rows.map(({ role, onboarding, invoice }) => ({ role, onboarding, invoice })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setSaved(true);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf8f1]">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logos/gns.png" alt="GNS" width={36} height={36} className="object-contain" />
            <div>
              <p className="text-sm font-bold text-gray-900">Role Permissions</p>
              <p className="text-[11px] text-gray-400">Partner control panel</p>
            </div>
          </div>
          <Link href="/dashboard" className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Who can see which agent</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Turn each module on or off per role. Changes take effect the next time a user loads
            their dashboard. Administrator and Partner always keep full access.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : error && !rows ? (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
        ) : rows ? (
          <>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-4 border-b border-gray-100 bg-gray-50/60 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <div>Role</div>
                <div className="w-28 text-center">Onboarding</div>
                <div className="w-28 text-center">Invoices</div>
              </div>
              {rows.map((r) => (
                <div
                  key={r.role}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-4 border-b border-gray-50 last:border-0 items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      {ROLE_LABELS[r.role] || r.role}
                      {r.locked && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                          Always on
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{ROLE_HINT[r.role] || ''}</p>
                  </div>
                  <div className="w-28 flex justify-center">
                    <Toggle
                      on={r.onboarding}
                      disabled={r.locked}
                      color="#7c3aed"
                      onChange={() => setCell(r.role, 'onboarding', !r.onboarding)}
                    />
                  </div>
                  <div className="w-28 flex justify-center">
                    <Toggle
                      on={r.invoice}
                      disabled={r.locked}
                      color="#059669"
                      onChange={() => setCell(r.role, 'invoice', !r.invoice)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={save}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saved && <span className="text-sm font-semibold text-emerald-600">✓ Saved</span>}
              {error && <span className="text-sm font-semibold text-red-600">{error}</span>}
            </div>

            <p className="mt-8 text-xs text-gray-400 max-w-2xl">
              Note: junior staff typically get <strong>Invoices only</strong>; managers and above get
              both. If this table is ever unavailable, the app safely falls back to those default
              rules so no one is locked out.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
