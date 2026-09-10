import { createRoot, Root } from 'react-dom/client';
import { memo } from 'react';
import { PulsingAvatar } from './PulsingAvatar';
import { useGridPhotoSrc } from '../lib/nearbyPhotoSrc';
import { FadedBrandFace, isNearbyPlaceholderFace } from './FadedBrandFace';

export interface MapMarkerUser {
  id: string;
  name: string;
  photo_url?: string;
  age?: number;
  isPulsing: boolean;
  isVerified?: boolean;
}

interface MapMarkerProps {
  user: MapMarkerUser;
  size?: number;
}

export const MapMarker = memo(function MapMarker({ user, size = 44 }: MapMarkerProps) {
  return (
    <div
      className={`cursor-pointer transition-transform duration-150 hover:scale-110 ${
        user.isPulsing ? 'animate-pulse-breathe' : ''
      }`}
      style={{ width: size, height: size }}
    >
      <PulsingAvatar
        isPulsing={user.isPulsing}
        size={size}
        intensity={user.isPulsing ? 'live' : 'subtle'}
        isVerified={user.isVerified}
      >
        <div
          className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg,#2A1C0A,#1E1508)',
            border: user.isPulsing ? '3px solid var(--copper-light)' : '2px solid var(--copper)',
            boxShadow: user.isPulsing
              ? '0 0 20px rgba(196,131,42,0.75), 0 4px 14px rgba(196,131,42,0.55)'
              : '0 3px 10px rgba(196,131,42,0.45)',
          }}
        >
          <MapPhoto name={user.name} photoUrl={user.photo_url} age={user.age} size={size} />
        </div>
      </PulsingAvatar>
    </div>
  );
});

function MapPhoto({
  name,
  photoUrl,
  age,
  size,
}: {
  name: string;
  photoUrl?: string;
  age?: number;
  size: number;
}) {
  const { src, phase } = useGridPhotoSrc(photoUrl, age);
  if (isNearbyPlaceholderFace(photoUrl, phase) || !src) {
    // Faded official medallion — same empty face as Nearby Grid (Brand).
    return <FadedBrandFace variant="pin" size={size} label={name} />;
  }
  return (
    <img
      src={src}
      alt={name}
      className="w-full h-full object-cover"
      draggable={false}
      decoding="async"
      data-testid="map-marker-photo"
      data-photo-phase={phase}
    />
  );
}

export function createMapMarkerElement(
  user: MapMarkerUser,
  onTap: () => void,
  size = 44,
): { element: HTMLDivElement; root: Root; suppressClickRef: { current: boolean } } {
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.touchAction = 'none';
  /** Set by wireHtmlMarkerMapGestures after a drag/pinch so click is ignored. */
  const suppressClickRef = { current: false };
  el.addEventListener('click', (e) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    e.stopPropagation();
    onTap();
  });
  const root = createRoot(el);
  root.render(<MapMarker user={user} size={size} />);
  return { element: el, root, suppressClickRef };
}
