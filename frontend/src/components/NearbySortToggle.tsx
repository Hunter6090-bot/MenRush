/**
 * Nearby Nearest ↔ Latest sort control.
 * Short Brand-safe labels only (sex/hookup app face — no soft dating-coded wording).
 * Phone-fit segmented pills (1×); mirrors Map/Grid copper chrome.
 */
import {
  NEARBY_SORT_LABELS,
  type NearbySortMode,
} from '../lib/nearbySort';

const MODES: NearbySortMode[] = ['nearest', 'latest'];

export function NearbySortToggle({
  mode,
  onChange,
}: {
  mode: NearbySortMode;
  onChange: (next: NearbySortMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Nearby sort"
      data-testid="nearby-sort-toggle"
      className="inline-flex min-h-[36px] items-stretch overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--copper)_55%,transparent)] bg-[color-mix(in_srgb,var(--copper)_8%,transparent)]"
    >
      {MODES.map((id) => {
        const active = mode === id;
        const label = NEARBY_SORT_LABELS[id];
        return (
          <button
            key={id}
            type="button"
            data-testid={`nearby-sort-${id}`}
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(id)}
            className={
              active
                ? 'min-h-[36px] px-3 py-1.5 text-[15px] font-extrabold uppercase tracking-[0.14em] text-[var(--nn-on-copper)] bg-[var(--copper)] transition-colors'
                : 'min-h-[36px] px-3 py-1.5 text-[15px] font-extrabold uppercase tracking-[0.14em] text-[var(--nn-accent-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--copper)_18%,transparent)]'
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
