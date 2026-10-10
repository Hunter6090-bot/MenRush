import type { ReactNode } from 'react';
import { VerifiedBadge } from './VerifiedBadge';

/** Bright green so the online photo rim reads on night and cream tiles. */
export const ONLINE_PHOTO_BORDER_COLOR = '#4ADE80';

export type DiscoveryPhotoShape = 'square' | 'circle';

interface DiscoveryPhotoFrameProps {
  children: ReactNode;
  online?: boolean;
  verified?: boolean;
  className?: string;
  size?: number;
  /** Extra classes for the inset online rim (map pins use a slightly thicker stroke). */
  borderClassName?: string;
  /** Nearby Grid = square tile; Discover map member pins = circle (Pete lock). */
  shape?: DiscoveryPhotoShape;
}

/**
 * Shared Nearby Grid + map pin chrome.
 * Online = green inset rim following the photo shape. Verified = tick only, no circular badge.
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
  const isCircle = shape === 'circle';
  const round = isCircle ? 'rounded-full' : '';
  return (
    <div
      className={`relative overflow-hidden ${round} ${className}`.replace(/\s+/g, ' ').trim()}
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
          className={`pointer-events-none absolute inset-0 z-[8] box-border ${round} ${borderClassName}`.replace(/\s+/g, ' ').trim()}
          style={{ borderColor: ONLINE_PHOTO_BORDER_COLOR, borderStyle: 'solid' }}
        />
      ) : null}
      {verified ? (
        <VerifiedBadge
          compact
          // Circle pins: tuck the tick toward the centre so the arc does not clip it.
          className={`absolute z-10 ${isCircle ? 'bottom-[12%] right-[12%]' : 'bottom-1 right-1'}`}
        />
      ) : null}
    </div>
  );
}
