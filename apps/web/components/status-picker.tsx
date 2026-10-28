'use client';

/**
 * A row of small status boxes — one per option, all visible, one click to set.
 *
 * It replaced dropdowns on the handover and clearance screens. A dropdown
 * hides every option but the current one and costs two clicks per line; across
 * a two-dozen-item checklist that is the difference between a tracker kept
 * current and one left stale but still believed.
 *
 * Separate boxes rather than a joined segmented control, deliberately: on a
 * page that is mostly a form, joined controls read as one field with a value,
 * while separate ones read as a set of choices — which is what they are.
 */

export interface StatusOption<T extends string> {
  value: T;
  label: string;
  /** Classes applied only when this option is the chosen one. */
  on: string;
}

export function StatusPicker<T extends string>({
  value,
  options,
  onPick,
  busy = false,
  compact = true,
  ariaLabel = 'Status',
}: {
  value: T;
  options: ReadonlyArray<StatusOption<T>>;
  onPick: (value: T) => void;
  busy?: boolean;
  /** Compact is the default; the roomier size suits a page with few rows. */
  compact?: boolean;
  ariaLabel?: string;
}) {
  const pad = compact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs';
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const chosen = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.label}
            aria-pressed={chosen}
            disabled={busy}
            onClick={() => { if (!chosen) onPick(o.value); }}
            className={`${pad} rounded-md border font-semibold transition-colors disabled:opacity-50 ${
              chosen ? o.on : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The four states a handover item can be in. */
export const HANDOVER_STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending',  on: 'bg-amber-100 border-amber-300 text-amber-900' },
  { value: 'received', label: 'Received', on: 'bg-green-100 border-green-300 text-green-900' },
  { value: 'verified', label: 'Verified', on: 'bg-green-600 border-green-600 text-white' },
  { value: 'na',       label: 'N/A',      on: 'bg-gray-200 border-gray-300 text-gray-700' },
] as const satisfies ReadonlyArray<StatusOption<'pending' | 'received' | 'verified' | 'na'>>;

/** What a clearance item can be. "Requested" because we asked for it. */
export const CLEARANCE_STATUS_OPTIONS = [
  { value: 'pending',  label: 'Requested', on: 'bg-amber-100 border-amber-300 text-amber-900' },
  { value: 'received', label: 'Received',  on: 'bg-green-100 border-green-300 text-green-900' },
  { value: 'na',       label: 'N/A',       on: 'bg-gray-200 border-gray-300 text-gray-700' },
] as const satisfies ReadonlyArray<StatusOption<'pending' | 'received' | 'na'>>;
