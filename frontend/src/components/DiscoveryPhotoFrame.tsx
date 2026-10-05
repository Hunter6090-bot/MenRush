import type { ReactNode } from 'react';
import { VerifiedBadge } from './VerifiedBadge';

/** Bright green so the square photo rim reads on night and cream tiles. */
export const ONLINE_PHOTO_BORDER_COLOR = '#4ADE80';

interface DiscoveryPhotoFrameProps {
  children: ReactNode;
  online?: boolean;
  verified?: boolean;
  className?: string;
  size?: number;
  /** Extra classes for the inset online rim (map pins use a slightly thicker stroke). */
  borderClassName?: string;
}

/**
 * Shared Nearby Grid + map pin chrome.
 * Online = green border on the square photo. Verified = tick only, no circular badge.
 */
export function DiscoveryPhotoFrame({
  children,
  online = false,
  verified = false,
  className = '',
  size,
  borderClassName = 'border-[3px]',
}: DiscoveryPhotoFrameProps) {
  return (
    <div
      className={`relative overflow-hidden ${className}`.trim()}
      style={size != null ? { width: size, height: size } : undefined}
      data-testid="discovery-photo-frame"
      data-online={online ? 'true' : 'false'}
    >
      {children}
      {online ? (
        <span
          data-testid="online-photo-border"
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-[8] box-border ${borderClassName}`}
          style={{ borderColor: ONLINE_PHOTO_BORDER_COLOR, borderStyle: 'solid' }}
        />
      ) : null}
      {verified ? (
        <VerifiedBadge compact className="absolute bottom-1 right-1 z-10" />
      ) : null}
    </div>
  );
}
