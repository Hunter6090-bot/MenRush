import { useState } from 'react';
import { MapDiscretionSlider } from './MapDiscretionSlider';
import { CruisingSearchBar } from './CruisingSearchBar';
import { IconMapExpand, IconDiscover, IconHotSpots } from './icons';
import { HOT_SPOTS_CHIP_LABEL, HOT_SPOTS_MAP_BANNER } from '../lib/cruiseCopy';
import { dismissHotSpotsMapBanner, isHotSpotsMapBannerDismissed } from '../lib/hotSpotsMapBanner';
import { formatFuzzPrivacyNote } from '../lib/mapPinFuzz';

const mapChromeBtnClass =
  'flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 touch-manipulation cursor-pointer items-center justify-center rounded-full border border-[rgba(196,131,42,0.4)] bg-[color-mix(in_srgb,#FFF8F0_92%,transparent)] text-[#3D2B0E] shadow-md backdrop-blur-md transition-transform active:scale-95';

/**
 * Shared map chrome — one control cluster per corner.
 * TL: Discretion (pin randomization) · TR: layers + expand · BL: Chat FAB (dock).
 * BR: Mapbox locate (+ zoom on desktop only; phone uses pinch).
 * Search radius lives only in the list "All" miles dropdown (not duplicated here).
 * Nearby/live count lives in the list pill only (no map status card).
 */
export function MapFloatingChrome({
  expanded,
  mapPinFuzzM,
  onMapPinFuzzChange,
  onToggleExpand,
  showHide = false,
  onHide,
  peopleLayerOn,
  hotSpotsLayerOn,
  onTogglePeopleLayer,
  onToggleHotSpotsLayer,
  onOpenCruisingSearch,
  showPrivacyNote = false,
}: {
  expanded: boolean;
  mapPinFuzzM: number;
  onMapPinFuzzChange: (meters: number) => void;
  onToggleExpand: () => void;
  showHide?: boolean;
  onHide?: () => void;
  peopleLayerOn: boolean;
  hotSpotsLayerOn: boolean;
  onTogglePeopleLayer: () => void;
  onToggleHotSpotsLayer: () => void;
  onOpenCruisingSearch?: () => void;
  showPrivacyNote?: boolean;
}) {
  // One-time Legal quiet-face dismiss — same localStorage pattern as match coach.
  const [mapBannerDismissed, setMapBannerDismissed] = useState(isHotSpotsMapBannerDismissed);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex max-h-full flex-col gap-2 overflow-y-auto p-3" data-testid="map-floating-chrome">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {!expanded ? (
          <div className="pointer-events-auto max-w-full" data-map-chrome-corner="top-left">
            <MapDiscretionSlider valueM={mapPinFuzzM} onChange={onMapPinFuzzChange} />
          </div>
        ) : (
          <span />
        )}
        <div
          className="pointer-events-auto ml-auto flex shrink-0 items-center gap-1.5"
          data-map-chrome-corner="top-right"
        >
          {/* #67: compact independent People / Cruise (Hot Spots) layer control. */}
          <button
            type="button"
            onClick={onTogglePeopleLayer}
            data-testid="layer-toggle-people"
            aria-label={peopleLayerOn ? 'Hide people' : 'Show people'}
            aria-pressed={peopleLayerOn}
            title={peopleLayerOn ? 'Hide people' : 'Show people'}
            className={`${mapChromeBtnClass} ${peopleLayerOn ? '' : 'opacity-45'}`}
          >
            <IconDiscover size={18} />
          </button>
          <button
            type="button"
            onClick={onToggleHotSpotsLayer}
            data-testid="layer-toggle-hotspots"
            aria-label={hotSpotsLayerOn ? `Hide ${HOT_SPOTS_CHIP_LABEL}` : `Show ${HOT_SPOTS_CHIP_LABEL}`}
            aria-pressed={hotSpotsLayerOn}
            title={hotSpotsLayerOn ? `Hide ${HOT_SPOTS_CHIP_LABEL}` : `Show ${HOT_SPOTS_CHIP_LABEL}`}
            className={`${mapChromeBtnClass} ${hotSpotsLayerOn ? '' : 'opacity-45'} !w-auto gap-1 px-2.5`}
          >
            <IconHotSpots size={18} />
            <span className="hidden text-[10px] font-extrabold tracking-wide sm:inline">
              {HOT_SPOTS_CHIP_LABEL}
            </span>
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            data-testid="map-expand-toggle"
            aria-label={expanded ? 'Shrink map' : 'Expand map'}
            title={expanded ? 'Shrink map' : 'Expand map'}
            className={mapChromeBtnClass}
          >
            <IconMapExpand size={18} collapse={expanded} />
          </button>
          {showHide && !expanded && onHide ? (
            <button
              type="button"
              onClick={onHide}
              data-testid="map-hide"
              aria-label="Hide map"
              title="Hide map"
              className={mapChromeBtnClass}
            >
              <span className="text-lg leading-none font-light" aria-hidden>
                −
              </span>
            </button>
          ) : null}
        </div>
      </div>
      {onOpenCruisingSearch ? (
        <div className="flex shrink-0 justify-center">
          <div className="pointer-events-auto">
            <CruisingSearchBar onOpen={onOpenCruisingSearch} />
          </div>
        </div>
      ) : null}
      {hotSpotsLayerOn && !mapBannerDismissed ? (
        <div
          className="flex shrink-0 justify-center"
          data-testid="hotspots-map-helper"
        >
          <div
            className="pointer-events-auto relative max-w-sm rounded-lg border py-2 pl-2.5 pr-12"
            style={{
              background: 'rgba(13,10,6,0.82)',
              borderColor: 'rgba(196,131,42,0.28)',
            }}
            role="status"
          >
            <p
              className="text-center text-[9px] font-semibold leading-snug tracking-wide"
              style={{ color: 'rgba(240,224,192,0.82)' }}
              data-testid="hotspots-map-helper-copy"
            >
              {HOT_SPOTS_MAP_BANNER}
            </p>
            <button
              type="button"
              data-testid="hotspots-map-helper-dismiss"
              aria-label="Dismiss map disclaimer"
              title="Dismiss"
              onClick={() => {
                setMapBannerDismissed(true);
                dismissHotSpotsMapBanner();
              }}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-[15px] leading-none text-[rgba(240,224,192,0.85)] transition-colors hover:bg-[rgba(196,131,42,0.18)] hover:text-[rgba(240,224,192,1)]"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      {showPrivacyNote ? (
        <p className="self-center rounded-full bg-black/60 px-2.5 py-1 text-center text-[10px] text-[#F0E0C0]" data-testid="map-privacy-note">
          {formatFuzzPrivacyNote(mapPinFuzzM)}
        </p>
      ) : null}
    </div>
  );
}
