import type { ReactNode } from 'react';
import { VerifiedBadge } from './VerifiedBadge';

/** Bright green so the photo rim reads on night and cream tiles. */
export const ONLINE_PHOTO_BORDER_COLOR = '#4ADE80';

interface DiscoveryPhotoFrameProps {
  children: ReactNode;
  online?: boolean;
  verified?: boolean;
  className?: string;
  size?: number;
  /** Extra classes for the inset online rim (map pins use a slightly thicker stroke). */
  borderClassName?: string;
  /** Grid tiles stay square. Map pins are circles (Pete lock). */
  shape?: 'square' | 'circle';
}

/**
 * Shared Nearby Grid + map pin chrome.
 * Online = green border on the photo. Grid = square. Map = circle.
 * Verified = tick only, no circular badge.
 */
export function DiscoveryPhotoFrame({
  children,
  online = false,
  verified = false,
  className = '',
  size,
  borderClassName = 'border-[3px]',
  shape = 'square',
}: DiscoveryPhotoFrameProps) {
  const round = shape === 'circle' ? 'rounded-full' : '';
  return (
    <div
      className={`relative overflow-hidden ${round} ${className}`.trim()}
      style={size != null ? { width: size, height: size } : undefined}
      data-testid="discovery-photo-frame"
      data-online={online ? 'true' : 'false'}
      data-shape={shape}
    >
      {children}
      {online ? (
        <span
          data-testid="online-photo-border"
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-[8] box-border ${borderClassName} ${round}`.trim()}
          style={{ borderColor: ONLINE_PHOTO_BORDER_COLOR, borderStyle: 'solid' }}
        />
      ) : null}
      {verified ? (
        <VerifiedBadge compact className="absolute bottom-1 right-1 z-10" />
      ) : null}
    </div>
  );
}
