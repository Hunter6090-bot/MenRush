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
 * Always-visible Hot Spot marker.
 * Empty (no live check-ins) → dim / transparent.
 * Occupied (any check-in) → full / solid icon.
 */
export function HotSpotPin({ spot, size = 36 }: HotSpotPinProps) {
  const occupied = spot.live_count_exact > 0;
  return (
    <div
      className="hotspot-pin"
      title={
        occupied
          ? `${spot.name} · ${spot.live_count_exact} checked in`
          : `${spot.name} · no one checked in`
      }
      style={{
        width: size,
        height: size,
        position: 'relative',
        opacity: occupied ? 1 : 0.38,
        filter: occupied ? 'none' : 'saturate(0.55)',
        transition: 'opacity 180ms ease, transform 150ms ease, filter 180ms ease',
      }}
      data-occupied={occupied ? '1' : '0'}
      data-testid={`hotspot-pin-${occupied ? 'solid' : 'dim'}`}
    >
      <div
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{
          background: occupied
            ? 'linear-gradient(145deg, #C4832A 0%, #8B5A1A 100%)'
            : 'linear-gradient(145deg, rgba(196,131,42,0.45) 0%, rgba(90,60,20,0.55) 100%)',
          border: occupied ? '2px solid #F0E0C0' : '1.5px solid rgba(240,224,192,0.35)',
          boxShadow: occupied
            ? '0 0 14px rgba(196,131,42,0.65), 0 3px 10px rgba(0,0,0,0.45)'
            : '0 2px 6px rgba(0,0,0,0.35)',
          fontSize: size * 0.42,
          lineHeight: 1,
        }}
      >
        <span aria-hidden>{spot.category_icon || '📍'}</span>
      </div>
      {occupied ? (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1A0E03] px-1 text-[9px] font-extrabold text-[#E0A14A]"
          style={{ position: 'absolute', right: -2, top: -2 }}
        >
          {spot.live_count_exact > 9 ? '9+' : spot.live_count_exact}
        </span>
      ) : null}
    </div>
  );
}

export function createHotSpotPinElement(
  spot: HotSpotPinData,
  onTap: () => void,
  size = 36,
): { element: HTMLDivElement; root: Root } {
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.position = 'relative';
  el.style.cursor = 'pointer';
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onTap();
  });
  const root = createRoot(el);
  root.render(<HotSpotPin spot={spot} size={size} />);
  return { element: el, root };
}
