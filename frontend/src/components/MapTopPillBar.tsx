import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { offsetBelowTopPrompt, useTopPromptBottom } from '../lib/topPromptOverlay';
/**
 * Map-first top chrome: Radius / Filters (icon + short label). App-wide search
 * lives in the top-right Menu and on the Chat list, not on the map.
 * Pete redesign Step 1.
 */
import { formatRadiusControlLabel } from '../lib/discoveryFormat';

const pillClass =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[rgba(196,131,42,0.55)] bg-[rgba(30,21,8,0.92)] px-3.5 py-2 text-[15px] font-extrabold text-[#F0E0C0] shadow-md backdrop-blur-sm transition-colors hover:border-[var(--copper)] hover:text-[var(--copper)]';

export function MapTopPillBar({
  radiusKm,
  onRadiusClick,
  onFiltersClick,
  filtersActive = false,
  children,
}: {
  radiusKm: number;
  onRadiusClick: () => void;
  onFiltersClick: () => void;
  filtersActive?: boolean;
  /** Second row (Discretion / layers): stacked in-flow so it never sits under wrapping pills. */
  children?: ReactNode;
}) {
  const radiusLabel = formatRadiusControlLabel(radiusKm);
  // While the floating alerts banner is on screen, move the pills below it so
  // Radius and Filters stay visible and tappable. Measured against the map
  // panel (this stack's positioned parent), which does not move.
  const stackRef = useRef<HTMLDivElement | null>(null);
  const bannerBottom = useTopPromptBottom();
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const panel = stackRef.current?.parentElement;
    if (!panel || bannerBottom == null) {
      setOffset(0);
      return;
    }
    const measure = () => setOffset(offsetBelowTopPrompt(panel.getBoundingClientRect().top, bannerBottom));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [bannerBottom]);

  return (
    <div
      ref={stackRef}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3 pt-3"
      style={offset > 0 ? { top: `${offset}px` } : undefined}
      data-offset-for-banner={offset}
      data-testid="map-top-stack"
    >
      {/* flex-nowrap: wrapping at 360px covered Discretion; one scrollable row keeps height stable. */}
      <div
        className="pointer-events-auto flex max-w-full flex-nowrap items-center justify-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="map-top-pill-bar"
      >
        <button
          type="button"
          data-testid="map-pill-radius"
          aria-label={`Radius ${radiusLabel}`}
          onClick={onRadiusClick}
          className={pillClass}
        >
          <RadiusGlyph />
          <span>Radius {radiusLabel.replace(/^Radius\s+/i, '')}</span>
        </button>
        <button
          type="button"
          data-testid="map-pill-filters"
          aria-label="Filters"
          aria-pressed={filtersActive}
          onClick={onFiltersClick}
          className={`${pillClass} ${filtersActive ? 'border-[var(--copper)] text-[var(--copper)]' : ''}`}
        >
          <FiltersGlyph />
          <span>Filters</span>
        </button>
      </div>
      {children ? (
        <div className="pointer-events-none w-full" data-testid="map-top-stack-below">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function RadiusGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function FiltersGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}
