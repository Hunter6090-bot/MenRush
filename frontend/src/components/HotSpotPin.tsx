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
export function HotSpotPin({ spot, size = 40 }: HotSpotPinProps) {
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
        opacity: occupied ? 1 : 0.72,
        filter: occupied ? 'none' : 'saturate(0.75) contrast(1.08)',
        transition: 'opacity 180ms ease, transform 150ms ease, filter 180ms ease',
      }}
      data-occupied={occupied ? '1' : '0'}
      data-testid={`hotspot-pin-${occupied ? 'solid' : 'dim'}`}
      data-hotspot-id={spot.id}
    >
      <div
        className="flex h-full w-full items-center justify-center rounded-full hotspot-pin__disc"
        style={{
          background: occupied
            ? 'linear-gradient(145deg, #C4832A 0%, #8B5A1A 100%)'
            : 'linear-gradient(145deg, rgba(196,131,42,0.82) 0%, rgba(120,78,24,0.88) 100%)',
          border: occupied ? '2.5px solid #F0E0C0' : '2px solid rgba(240,224,192,0.72)',
          boxShadow: occupied
            ? '0 0 16px rgba(196,131,42,0.7), 0 3px 10px rgba(0,0,0,0.45)'
            : '0 0 10px rgba(196,131,42,0.45), 0 3px 8px rgba(0,0,0,0.35)',
          fontSize: size * 0.44,
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
