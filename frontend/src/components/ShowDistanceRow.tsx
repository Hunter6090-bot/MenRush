import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Show distance (Premium to hide). Default on. Off means others see "Nearby"
 * instead of miles. Same switch look as the Stats Show toggles.
 */
export function ShowDistanceRow({
  checked,
  onChange,
  entitled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Premium (or Premium included). Needed to switch distance off. */
  entitled: boolean;
}) {
  const [needsPremium, setNeedsPremium] = useState(false);

  const toggle = () => {
    const next = !checked;
    if (!next && !entitled) {
      setNeedsPremium(true);
      return;
    }
    setNeedsPremium(false);
    onChange(next);
  };

  return (
    <div
      className="flex items-center gap-3 border-t border-[var(--border-default)]/70 py-3"
      data-testid="profile-stats-distance"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--cream-muted)]">
          Distance
        </p>
        <p className="mt-0.5 text-base text-[var(--cream)]" data-testid="profile-distance-state">
          {checked ? 'Shown in miles' : 'Shows as Nearby'}
        </p>
        {needsPremium ? (
          <p className="mt-1 text-sm font-semibold text-[var(--copper)]" role="status">
            Premium hides distance.{' '}
            <Link to="/premium" className="underline" data-testid="profile-distance-premium">
              Get Premium
            </Link>
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Show distance"
        data-testid="profile-show-distance"
        onClick={toggle}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4832A]/60 ${
          checked ? 'bg-[#C4832A]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#F0E0C0] shadow transition-transform ${
            checked ? 'left-4' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}
