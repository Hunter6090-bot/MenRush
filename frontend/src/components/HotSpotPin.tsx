import { createRoot, type Root } from 'react-dom/client';
import { IconCruise } from './icons';
import { CRUISE_PIN_LABEL } from '../lib/cruiseCopy';

export type HotSpotPinData = {
  id: string;
  name: string;
  category_icon?: string;
  /** Exact live check-in count (anonymous + profile). */
  live_count_exact: number;
  /** Approximate display count (may be rounded for Free). */
  live_count?: number | string;
};

interface HotSpotPinProps {
  spot: HotSpotPinData;
  size?: number;
}

/**
 * Always-visible Cruise marker on the Nearby map — cruise-ship icon at a glance.
 * Pin label is Brand "Cruise". Chip on the map chrome is "Hot Spots".
 * Empty: solid copper pin (slightly quieter, never near-invisible).
 * Occupied: larger glow + pulse + venue name + approximate check-in count.
 * Does not invent venues or occupancy — only renders existing check-in data.
 */
export function HotSpotPin({ spot, size = 48 }: HotSpotPinProps) {
  const occupied = spot.live_count_exact > 0;
  const pinSize = occupied ? size : Math.round(size * 0.92);
  const countLabel =
    spot.live_count != null
      ? String(spot.live_count)
      : spot.live_count_exact > 9
        ? '9+'
        : String(spot.live_count_exact);

  return (
    <div
      className="hotspot-pin"
      title={
        occupied
          ? `${spot.name} · ${countLabel} checked in`
          : `${spot.name} · ${CRUISE_PIN_LABEL}`
      }
      style={{
        width: pinSize,
        height: pinSize,
        position: 'relative',
        opacity: 1,
        transition: 'transform 150ms ease, filter 180ms ease',
        transform: occupied ? 'scale(1.06)' : 'scale(1)',
        zIndex: occupied ? 2 : 1,
      }}
      data-occupied={occupied ? '1' : '0'}
      data-testid={`hotspot-pin-${occupied ? 'solid' : 'dim'}`}
      data-hotspot-id={spot.id}
      data-hotspot-name={spot.name}
      data-cruise-pin="1"
      data-cruise-label={CRUISE_PIN_LABEL}
    >
      {occupied ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: '9999px',
            border: '2px solid rgba(196,131,42,0.7)',
            boxShadow: '0 0 18px rgba(196,131,42,0.75)',
            animation: 'mr-radar 1.6s ease-out infinite',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '9999px',
            background: 'rgba(196,131,42,0.22)',
            boxShadow: '0 0 0 2px rgba(240,224,192,0.55)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{
          background: occupied
            ? 'linear-gradient(145deg, #E0A14A 0%, #C4832A 45%, #8B5A1A 100%)'
            : 'linear-gradient(145deg, #C4832A 0%, #A06A28 55%, #6E4518 100%)',
          border: occupied ? '3px solid #FFF6E6' : '2.5px solid #F0E0C0',
          boxShadow: occupied
            ? '0 0 20px rgba(196,131,42,0.85), 0 4px 14px rgba(0,0,0,0.55)'
            : '0 0 10px rgba(196,131,42,0.45), 0 3px 10px rgba(0,0,0,0.5)',
          color: '#FFF6E6',
        }}
      >
        <IconCruise
          size={Math.round(pinSize * 0.52)}
          aria-hidden
          data-testid="cruise-ship-icon"
          style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))' }}
        />
      </div>
      {occupied ? (
        <span
          className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold"
          style={{
            position: 'absolute',
            right: -4,
            top: -4,
            background: '#1A0E03',
            color: '#E0A14A',
            border: '1.5px solid #C4832A',
            boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
          }}
          data-testid="hotspot-pin-count"
        >
          {countLabel}
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -2,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '8px solid #C4832A',
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))',
          }}
        />
      )}
      <span
        data-testid={occupied ? 'hotspot-pin-name' : 'cruise-pin-label'}
        style={{
          position: 'absolute',
          left: '50%',
          top: '100%',
          transform: 'translateX(-50%)',
          marginTop: occupied ? 4 : 6,
          maxWidth: 96,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '2px 6px',
          borderRadius: 999,
          background: 'rgba(26, 14, 3, 0.92)',
          border: '1px solid rgba(196,131,42,0.55)',
          color: '#F0E0C0',
          fontSize: 10,
          fontWeight: 800,
          lineHeight: 1.2,
          pointerEvents: 'none',
        }}
      >
        {occupied ? spot.name : CRUISE_PIN_LABEL}
      </span>
    </div>
  );
}

export function createHotSpotPinElement(
  spot: HotSpotPinData,
  _onTap: () => void,
  size = 48,
): { element: HTMLDivElement; root: Root } {
  const el = document.createElement('div');
  const occupied = spot.live_count_exact > 0;
  el.style.width = `${Math.max(size, occupied ? 104 : 72)}px`;
  el.style.height = `${size + 28}px`;
  el.style.position = 'relative';
  el.style.cursor = 'pointer';
  el.style.zIndex = occupied ? '3' : '2';
  el.style.display = 'flex';
  el.style.justifyContent = 'center';
  // Canvas owns pan/pinch — markers must not capture touches (see mapMarkerHitTest).
  // Tap opens the Cruise sheet via map click hit-test in Discover.
  el.style.touchAction = 'none';
  el.style.pointerEvents = 'none';
  const root = createRoot(el);
  root.render(<HotSpotPin spot={spot} size={size} />);
  return { element: el, root };
}
