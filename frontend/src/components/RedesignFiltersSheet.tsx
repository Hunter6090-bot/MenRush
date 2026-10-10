/**
 * Map Filters bottom sheet, matched to the Claude Design board (state 04):
 * Close, Age range, Visiting / Now / Photo only, Reset / Show.
 * Visiting is not built yet (Travel, #359), so it shows a muted Coming soon tag
 * and no toggle. The NEW filter it used to stand in for keeps its own honest row
 * ("New here") so nothing is lost. Full discovery filter state still drives results.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ComingSoonTag } from './ComingSoonTag';
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
  const newHere = draft.status.includes('new');
  const [visitingNote, setVisitingNote] = useState(false);
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
      <div className="absolute inset-x-0 bottom-0 rounded-t-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-card)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[var(--border-strong)]" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-[var(--cream)]">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="filter-close"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--border-default)] px-4 text-[15px] font-bold text-[var(--cream)]"
          >
            <IconX />
            Close
          </button>
        </div>

        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[15px] font-bold text-[var(--cream)]">
            <RowIcon><IconCalendar /></RowIcon>
            Age
          </span>
          <span className="text-[15px] font-bold text-[var(--nn-accent-text)]" data-testid="filter-age-range">
            {ageMin} to {ageMax}
          </span>
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

        <button
          type="button"
          data-testid="filter-visiting"
          aria-describedby={visitingNote ? 'filter-visiting-note' : undefined}
          onClick={() => setVisitingNote((v) => !v)}
          className="mb-2 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 text-left"
        >
          <span className="flex items-center gap-2 text-[15px] font-bold text-[var(--cream)]">
            <RowIcon><IconSuitcase /></RowIcon>
            Visiting
          </span>
          <ComingSoonTag />
        </button>
        {visitingNote ? (
          <p id="filter-visiting-note" role="status" className="mb-2 px-1 text-[15px] text-[var(--cream-muted)]" data-testid="filter-visiting-note">
            This filter is coming soon.
          </p>
        ) : null}
        <ToggleRow icon={<IconBolt />} label="Now" on={now} onChange={(v) => toggleStatus('online', v)} testId="filter-now" />
        <ToggleRow icon={<IconCamera />} label="Photo only" on={photoOnly} onChange={(v) => toggleStatus('hasPhoto', v)} testId="filter-photo-only" />
        <ToggleRow icon={<IconSpark />} label="New here" on={newHere} onChange={(v) => toggleStatus('new', v)} testId="filter-new" />

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            data-testid="filter-reset"
            onClick={() => setDraft({ ...DEFAULT_DISCOVERY_FILTERS })}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--cream)]/50 px-4 text-[15px] font-extrabold text-[var(--cream)]"
          >
            <IconReset />
            Reset
          </button>
          <button
            type="button"
            data-testid="filter-show"
            onClick={() => {
              onChange(draft);
              onShow();
            }}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[#C4832A] px-4 text-[15px] font-extrabold text-[#1A0E03]"
          >
            <IconPin />
            Show
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  on,
  onChange,
  testId,
}: {
  icon?: ReactNode;
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
      <span className="flex items-center gap-2 text-[15px] font-bold text-[var(--cream)]">
        {icon ? <RowIcon>{icon}</RowIcon> : null}
        {label}
      </span>
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

function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex text-[var(--nn-accent-text)]" aria-hidden>
      {children}
    </span>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {children}
    </svg>
  );
}
const IconX = () => <Svg><path d="M6 6l12 12M18 6L6 18" /></Svg>;
const IconCalendar = () => <Svg><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
const IconSuitcase = () => <Svg><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" /></Svg>;
const IconBolt = () => <Svg><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></Svg>;
const IconCamera = () => <Svg><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Svg>;
const IconSpark = () => <Svg><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></Svg>;
const IconReset = () => <Svg><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" /><path d="M3 3v5h5" /></Svg>;
const IconPin = () => <Svg><path d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" /><circle cx="12" cy="11" r="2.25" /></Svg>;
