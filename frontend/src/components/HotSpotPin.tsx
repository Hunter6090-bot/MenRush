import { createRoot, type Root } from 'react-dom/client';

export type HotSpotPinData = {
  id: string;
  name: string;
  category_icon?: string;
  /** Exact live check-in count (anonymous + profile). */
  live_count_exact: number;
};

interface HotSpotPinProps {
  spot: HotSpotPinData;
  size?: number;
}

/**
 * Always-visible Hot Spot marker — must read as a cruising venue at a glance.
 * Empty: solid copper pin (slightly quieter, never near-invisible).
 * Occupied: larger glow + pulse + live count badge.
 */
export function HotSpotPin({ spot, size = 48 }: HotSpotPinProps) {
  const occupied = spot.live_count_exact > 0;
  const pinSize = occupied ? size : Math.round(size * 0.92);

  return (
    <div
      className="hotspot-pin"
      title={
        occupied
          ? `${spot.name} · ${spot.live_count_exact} checked in`
          : `${spot.name} · Hot Spot`
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
          fontSize: pinSize * 0.4,
          lineHeight: 1,
          color: '#FFF6E6',
        }}
      >
        <span aria-hidden style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))' }}>
          {spot.category_icon || '📍'}
        </span>
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
        >
          {spot.live_count_exact > 9 ? '9+' : spot.live_count_exact}
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
    </div>
  );
}

export function createHotSpotPinElement(
  spot: HotSpotPinData,
  onTap: () => void,
  size = 48,
): { element: HTMLDivElement; root: Root } {
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size + 6}px`;
  el.style.position = 'relative';
  el.style.cursor = 'pointer';
  el.style.zIndex = spot.live_count_exact > 0 ? '3' : '2';
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onTap();
  });
  const root = createRoot(el);
  root.render(<HotSpotPin spot={spot} size={size} />);
  return { element: el, root };
}
