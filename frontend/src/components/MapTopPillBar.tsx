import type { ReactNode } from 'react';
/**
 * Map-first top chrome — Radius / Filters / Search (icon + short label).
 * Pete redesign Step 1.
 */
import { formatRadiusControlLabel } from '../lib/discoveryFormat';

const pillClass =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[rgba(196,131,42,0.55)] bg-[rgba(30,21,8,0.92)] px-3.5 py-2 text-[12px] font-extrabold text-[#F0E0C0] shadow-md backdrop-blur-sm transition-colors hover:border-[var(--copper)] hover:text-[var(--copper)]';

export function MapTopPillBar({
  radiusKm,
  onRadiusClick,
  onFiltersClick,
  onSearchClick,
  filtersActive = false,
  children,
}: {
  radiusKm: number;
  onRadiusClick: () => void;
  onFiltersClick: () => void;
  onSearchClick: () => void;
  filtersActive?: boolean;
  /** Second row (Discretion / layers) — stacked in-flow so it never sits under wrapping pills. */
  children?: ReactNode;
}) {
  const radiusLabel = formatRadiusControlLabel(radiusKm);
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3 pt-3"
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
        <button
          type="button"
          data-testid="map-pill-search"
          aria-label="Search"
          onClick={onSearchClick}
          className={pillClass}
        >
          <SearchGlyph />
          <span>Search</span>
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

function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
    </svg>
  );
}
