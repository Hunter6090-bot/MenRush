import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  MAP_OVERLAY_BOTTOM_CLEARANCE_CLASS,
  MAP_OVERLAY_PINNED_MAX_CLASS,
  MAP_SHORT_HEIGHT_PX,
  useClearanceBelowTopPrompt,
} from '../lib/topPromptOverlay';
/**
 * Map-first top chrome: Radius / Filters (icon + short label). App-wide search
 * lives in the top-right Menu and on the Chat list, not on the map.
 * Pete redesign Step 1.
 */
import { formatRadiusControlLabel } from '../lib/discoveryFormat';
import { MapShortNotesInfo } from './MapShortNotesInfo';

const pillClass =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[rgba(196,131,42,0.55)] bg-[rgba(30,21,8,0.92)] px-3.5 py-2 text-[15px] font-extrabold text-[#F0E0C0] shadow-md backdrop-blur-sm transition-colors hover:border-[var(--copper)] hover:text-[var(--copper)]';

export function MapTopPillBar({
  radiusKm,
  onRadiusClick,
  onFiltersClick,
  filtersActive = false,
  leading,
  layers,
  children,
  notes,
  footer,
  spotsNoteText,
  pinNoteText,
  spotsLayerOn = true,
}: {
  radiusKm: number;
  onRadiusClick: () => void;
  onFiltersClick: () => void;
  filtersActive?: boolean;
  /** Quiet-map Pulse. Tall maps only; sits under Radius / Filters. */
  leading?: ReactNode;
  /** People / spots icon buttons. Same row as the pills on a short map. */
  layers?: ReactNode;
  /** Map spots 18+ note. Tall maps only; after Pulse and layers. */
  children?: ReactNode;
  /** Closeable pin note. Tall maps only. */
  notes?: ReactNode;
  /** Compact empty-radius pill. Pinned, max ~25% of the map. */
  footer?: ReactNode;
  /** 18+ spots copy. Short maps open this from the info button. */
  spotsNoteText?: string | null;
  /** Discretion pin copy. Short maps open this from the info button. */
  pinNoteText?: string | null;
  /** 18+ unread dot / sheet copy only while the Spots layer is on. */
  spotsLayerOn?: boolean;
}) {
  const radiusLabel = formatRadiusControlLabel(radiusKm);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { offset, ready, animate } = useClearanceBelowTopPrompt(columnRef);
  const [mapHeight, setMapHeight] = useState(0);
  const [moreBelow, setMoreBelow] = useState(false);
  const short = mapHeight > 0 && mapHeight < MAP_SHORT_HEIGHT_PX;

  useLayoutEffect(() => {
    const el = columnRef.current;
    if (!el) return;
    const update = () => setMapHeight(el.getBoundingClientRect().height);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || short) {
      setMoreBelow(false);
      return;
    }
    const check = () => {
      setMoreBelow(el.scrollHeight - el.scrollTop > el.clientHeight + 4);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
    };
  }, [leading, layers, children, notes, offset, short]);

  const pills = (
    <>
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
    </>
  );

  return (
    <div
      ref={columnRef}
      className="pointer-events-none absolute inset-0 z-20 flex flex-col overflow-hidden"
      data-testid="map-overlay-column"
      data-offset-for-banner={offset}
      data-overlay-ready={ready ? 'true' : 'false'}
      data-map-short={short ? 'true' : 'false'}
      style={{ visibility: ready ? 'visible' : 'hidden' }}
    >
      <div
        className="shrink-0 overflow-hidden will-change-transform"
        data-testid="map-overlay-shift"
        data-offset-for-banner={offset}
        data-shift-animated={animate ? 'true' : 'false'}
        style={{
          height: offset,
          transform: 'translateY(0)',
          transition: animate ? 'height 200ms ease-out, transform 200ms ease-out' : 'none',
        }}
      />
        <div
        className={`flex min-h-[44px] min-w-0 flex-1 flex-col ${short ? 'overflow-visible' : 'overflow-hidden'}`}
        data-testid="map-overlay-top"
      >
        <div
          className={`relative flex shrink-0 flex-col gap-2 px-3 pt-3 ${short ? 'pr-14' : ''}`}
          data-testid="map-top-stack"
          data-offset-for-banner={offset}
        >
          <div
            className="pointer-events-none flex max-w-full flex-nowrap items-center justify-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            data-testid="map-top-pill-bar"
          >
            <div className="pointer-events-auto flex flex-nowrap items-center gap-2">
              {pills}
              {short && layers ? (
                <div
                  className="flex shrink-0 items-center gap-1.5 [&_[data-layer-label]]:hidden [&_[data-testid^='layer-toggle']]:h-11 [&_[data-testid^='layer-toggle']]:w-11 [&_[data-testid^='layer-toggle']]:min-h-[44px] [&_[data-testid^='layer-toggle']]:min-w-[44px] [&_[data-testid^='layer-toggle']]:px-0"
                  data-testid="map-top-stack-layers"
                >
                  {layers}
                </div>
              ) : null}
              {short ? (
                <MapShortNotesInfo
                  spotsText={spotsNoteText}
                  pinText={pinNoteText}
                  spotsLayerOn={spotsLayerOn}
                />
              ) : null}
            </div>
          </div>
        </div>
        {short ? null : (
          <div className="relative min-h-0 flex-1">
            <div
              ref={scrollRef}
              className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto overscroll-y-contain px-3 pb-2"
              data-testid="map-overlay-scroll"
            >
              {leading ? (
                <div className="pointer-events-auto w-full" data-testid="map-top-stack-leading">
                  {leading}
                </div>
              ) : null}
              {layers ? (
                <div className="flex w-full justify-end" data-testid="map-top-stack-layers">
                  {layers}
                </div>
              ) : null}
              {children ? (
                <div className="pointer-events-none w-full" data-testid="map-top-stack-below">
                  {children}
                </div>
              ) : null}
              {notes ? (
                <div className="pointer-events-none w-full" data-testid="map-overlay-notes">
                  {notes}
                </div>
              ) : null}
            </div>
            {moreBelow ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0D0A06] via-[rgba(240,224,192,0.22)] to-transparent [[data-theme=light]_&]:from-[#F5EDE0] [[data-theme=light]_&]:via-[rgba(184,115,42,0.22)]"
                data-testid="map-overlay-scroll-cue"
                aria-hidden
              />
            ) : null}
          </div>
        )}
      </div>
      {footer ? (
        <div
          className={`pointer-events-none shrink-0 overflow-hidden ${MAP_OVERLAY_PINNED_MAX_CLASS}`}
          data-testid="map-overlay-pinned"
        >
          {footer}
        </div>
      ) : null}
      <div
        className={`pointer-events-none min-h-0 shrink ${MAP_OVERLAY_BOTTOM_CLEARANCE_CLASS}`}
        data-testid="map-overlay-clearance"
        aria-hidden
      />
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
