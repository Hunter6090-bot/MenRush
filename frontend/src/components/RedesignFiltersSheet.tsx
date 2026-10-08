/**
 * Map Filters bottom sheet: Age range + Visiting / Now / Photo only + Reset / Show.
 * Full discovery filter state still drives results (no feature drop).
 */
import { useEffect, useState } from 'react';
import {
  AGE_CLAMP_MAX,
  AGE_CLAMP_MIN,
  DEFAULT_DISCOVERY_FILTERS,
  type DiscoveryFilterState,
  withCustomAge,
} from '../lib/discoveryFilters';

export function RedesignFiltersSheet({
  open,
  value,
  onChange,
  onClose,
  onShow,
}: {
  open: boolean;
  value: DiscoveryFilterState;
  onChange: (next: DiscoveryFilterState) => void;
  onClose: () => void;
  onShow: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  const ageMin = draft.customAgeMin ?? AGE_CLAMP_MIN;
  const ageMax = draft.customAgeMax ?? AGE_CLAMP_MAX;
  const visiting = draft.status.includes('new'); // visitor/fresh faces share NEW status
  const now = draft.status.includes('online');
  const photoOnly = draft.status.includes('hasPhoto');

  const toggleStatus = (id: 'new' | 'online' | 'hasPhoto', on: boolean) => {
    const set = new Set(draft.status);
    if (on) set.add(id);
    else set.delete(id);
    setDraft({ ...draft, status: [...set] as DiscoveryFilterState['status'] });
  };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Filters" data-testid="redesign-filters-sheet">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close filters" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[1.5rem] border border-[var(--border-default)] bg-[#1E1508] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[var(--border-strong)]" />
        <h2 className="mb-4 text-xl font-extrabold text-[#F0E0C0]">Filters</h2>

        <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-[var(--cream-muted)]">
          Age
        </label>
        <div className="mb-1 flex items-center justify-between text-[14px] font-bold text-[#F0E0C0]">
          <span>{ageMin}</span>
          <span>{ageMax}</span>
        </div>
        <div className="mb-5 flex gap-3">
          <input
            type="range"
            min={AGE_CLAMP_MIN}
            max={AGE_CLAMP_MAX}
            value={ageMin}
            data-testid="filter-age-min"
            onChange={(e) => {
              const next = Math.min(Number(e.target.value), ageMax);
              setDraft(withCustomAge(draft, next, ageMax));
            }}
            className="min-h-[44px] w-full accent-[#C4832A]"
          />
          <input
            type="range"
            min={AGE_CLAMP_MIN}
            max={AGE_CLAMP_MAX}
            value={ageMax}
            data-testid="filter-age-max"
            onChange={(e) => {
              const next = Math.max(Number(e.target.value), ageMin);
              setDraft(withCustomAge(draft, ageMin, next));
            }}
            className="min-h-[44px] w-full accent-[#C4832A]"
          />
        </div>

        <ToggleRow label="Visiting" on={visiting} onChange={(v) => toggleStatus('new', v)} testId="filter-visiting" />
        <ToggleRow label="Now" on={now} onChange={(v) => toggleStatus('online', v)} testId="filter-now" />
        <ToggleRow label="Photo only" on={photoOnly} onChange={(v) => toggleStatus('hasPhoto', v)} testId="filter-photo-only" />

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            data-testid="filter-reset"
            onClick={() => setDraft({ ...DEFAULT_DISCOVERY_FILTERS })}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-[var(--cream)]/50 px-4 text-[14px] font-extrabold text-[#F0E0C0]"
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="filter-show"
            onClick={() => {
              onChange(draft);
              onShow();
            }}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[#C4832A] px-4 text-[14px] font-extrabold text-[#1A0E03]"
          >
            Show
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onChange,
  testId,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-testid={testId}
      onClick={() => onChange(!on)}
      className="mb-2 flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4"
    >
      <span className="text-[15px] font-bold text-[#F0E0C0]">{label}</span>
      <span
        className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-[#C4832A]' : 'bg-[var(--border-default)]'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${on ? 'left-5' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}
