import { useRef, type ReactNode } from 'react';
import { useClearanceBelowTopPrompt } from '../lib/topPromptOverlay';
/**
 * Map-first top chrome: Radius / Filters (icon + short label). App-wide search
 * lives in the top-right Menu and on the Chat list, not on the map.
 * Pete redesign Step 1.
 */
import { formatRadiusControlLabel } from '../lib/discoveryFormat';

const PILL_STACK_PAD_PX = 12; // pt-3

const pillClass =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[rgba(196,131,42,0.55)] bg-[rgba(30,21,8,0.92)] px-3.5 py-2 text-[15px] font-extrabold text-[#F0E0C0] shadow-md backdrop-blur-sm transition-colors hover:border-[var(--copper)] hover:text-[var(--copper)]';

export function MapTopPillBar({
  radiusKm,
  onRadiusClick,
  onFiltersClick,
  filtersActive = false,
  leading,
  children,
  footer,
}: {
  radiusKm: number;
  onRadiusClick: () => void;
  onFiltersClick: () => void;
  filtersActive?: boolean;
  /** Floated on the map (quiet-map Pulse). Does not shrink the map panel. */
  leading?: ReactNode;
  /** Second row (Discretion / layers): stacked in-flow so it never sits under wrapping pills. */
  children?: ReactNode;
  /** Bottom of the map overlay column (empty-radius card). Flex spacer keeps it off the top stack. */
  footer?: ReactNode;
}) {
  const radiusLabel = formatRadiusControlLabel(radiusKm);
  // Full-height column clipped to the map. Banner clearance is padding (it takes
  // space). Pulse floats in `leading` so it never pushes the map down. Overflow
  // scrolls inside the map, so Widen / Map spots cannot sit under the tab bar,
  // PULSE FAB or chat dock. Hidden until the first layout measure so the first
  // paint is never a leftover offset (QC P2, y606 jump).
  const columnRef = useRef<HTMLDivElement | null>(null);
  const { offset, ready } = useClearanceBelowTopPrompt(columnRef);

  return (
    <div
      ref={columnRef}
      className="pointer-events-none absolute inset-0 z-20 flex flex-col overflow-y-auto overscroll-y-contain"
      data-testid="map-overlay-column"
      data-offset-for-banner={offset}
      data-overlay-ready={ready ? 'true' : 'false'}
    >
      {!ready ? null : (
      <div
        className="flex flex-col gap-2 px-3 pt-3"
        style={offset > 0 ? { paddingTop: `${PILL_STACK_PAD_PX + offset}px` } : undefined}
        data-offset-for-banner={offset}
        data-testid="map-top-stack"
      >
        {leading ? (
          <div className="pointer-events-auto w-full" data-testid="map-top-stack-leading">
            {leading}
          </div>
        ) : null}
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
      )}
      {ready ? <div className="min-h-0 flex-1" aria-hidden data-testid="map-overlay-spacer" /> : null}
      {ready ? footer : null}
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
