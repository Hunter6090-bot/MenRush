import { createRoot, Root } from 'react-dom/client';
import { memo } from 'react';
import { PulsingAvatar } from './PulsingAvatar';
import { DiscoveryPhotoFrame } from './DiscoveryPhotoFrame';
import { useGridPhotoSrc } from '../lib/nearbyPhotoSrc';
import { FadedBrandFace, isNearbyPlaceholderFace } from './FadedBrandFace';
import { NewJoinerBadge } from './NewJoinerBadge';
import { isUserOnlineNow } from '../lib/discovery';

export interface MapMarkerUser {
  id: string;
  name: string;
  photo_url?: string;
  age?: number;
  isPulsing: boolean;
  isVerified?: boolean;
  /** Account age within NEW window — small corner pill on pin. */
  isNew?: boolean;
  online?: boolean;
  last_seen?: string;
}

interface MapMarkerProps {
  user: MapMarkerUser;
  size?: number;
}

export const MapMarker = memo(function MapMarker({ user, size = 44 }: MapMarkerProps) {
  const online = isUserOnlineNow(user);

  return (
    <div
      className={`relative cursor-pointer transition-transform duration-150 hover:scale-110 ${
        user.isPulsing ? 'animate-pulse-breathe' : ''
      }`}
      style={{ width: size, height: size }}
      data-testid="map-marker"
      data-online={online ? 'true' : 'false'}
    >
      <PulsingAvatar
        isPulsing={user.isPulsing}
        size={size}
        intensity={user.isPulsing ? 'live' : 'subtle'}
        isVerified={false}
        shape="square"
      >
        <DiscoveryPhotoFrame
          online={online}
          verified={!!user.isVerified}
          className="h-full w-full"
          borderClassName="border-[3px]"
        >
          <div
            className="flex h-full w-full items-center justify-center overflow-hidden"
            style={{
              background: 'linear-gradient(135deg,#2A1C0A,#1E1508)',
              boxShadow: user.isPulsing
                ? '0 0 20px rgba(196,131,42,0.75), 0 4px 14px rgba(196,131,42,0.55)'
                : '0 3px 10px rgba(196,131,42,0.45)',
            }}
          >
            <MapPhoto name={user.name} photoUrl={user.photo_url} age={user.age} size={size} />
          </div>
        </DiscoveryPhotoFrame>
      </PulsingAvatar>
      {user.isNew ? <NewJoinerBadge variant="dot" /> : null}
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
  const trimmed = photoUrl?.trim() || '';
  if (phase === 'loading' && trimmed.startsWith('/uploads/')) {
    return (
      <div
        className="h-full w-full bg-[var(--bg-elevated)]"
        data-testid="map-marker-photo-pending"
        data-photo-phase={phase}
        aria-hidden
      />
    );
  }
  if (isNearbyPlaceholderFace(photoUrl, phase) || !src) {
    // Faded official medallion — same empty face as Nearby Grid (Brand).
    return <FadedBrandFace variant="pin" size={size} label={name} />;
  }
  return (
    <img
      src={src}
      alt={name}
      className="h-full w-full object-cover"
      draggable={false}
      decoding="async"
      data-testid="map-marker-photo"
      data-photo-phase={phase}
    />
  );
}

export function createMapMarkerElement(
  user: MapMarkerUser,
  _onTap: () => void,
  size = 44,
): { element: HTMLDivElement; root: Root } {
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  // Do not set position on this root — Mapbox needs absolute (see mapMarkerPlacement.ts).
  // Canvas owns pan/pinch — markers must not capture touches (see mapMarkerHitTest).
  // Tap opens profile via map click hit-test in Discover, not DOM click here.
  el.style.touchAction = 'none';
  el.style.pointerEvents = 'none';
  const root = createRoot(el);
  root.render(<MapMarker user={user} size={size} />);
  return { element: el, root };
}
