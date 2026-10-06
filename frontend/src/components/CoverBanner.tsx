import type { CSSProperties } from 'react';
import { useResolvingPhotoSrc } from './UserAvatar';

export interface CoverFrame {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_COVER_FRAME: CoverFrame = { x: 50, y: 50, zoom: 1 };

export function normalizeCoverFrame(
  x?: number | null,
  y?: number | null,
  zoom?: number | null,
): CoverFrame {
  return {
    x: clamp(x ?? 50, 0, 100),
    y: clamp(y ?? 50, 0, 100),
    zoom: clamp(zoom ?? 1, 1, 3),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function coverImageStyle(frame: CoverFrame): CSSProperties {
  return {
    objectPosition: `${frame.x}% ${frame.y}%`,
    transform: `scale(${frame.zoom})`,
    transformOrigin: `${frame.x}% ${frame.y}%`,
  };
}

interface CoverBannerProps {
  coverUrl: string;
  frame?: CoverFrame;
  className?: string;
  heightClassName?: string;
}

/** Profile header cover with saved pan/zoom framing. */
export function CoverBanner({
  coverUrl,
  frame = DEFAULT_COVER_FRAME,
  className = '',
  heightClassName = 'h-40 sm:h-32',
}: CoverBannerProps) {
  const normalized = normalizeCoverFrame(frame.x, frame.y, frame.zoom);
  // Walk upload candidates; legacy default / failed cover → neutral brand gradient
  // (never an old default image). Media lock: stored cover_url is untouched.
  const { src, onError } = useResolvingPhotoSrc(coverUrl);

  return (
    <div
      className={`relative w-full overflow-hidden ${heightClassName} ${className} ${
        src ? '' : 'bg-gradient-to-br from-[#C4832A]/30 via-[#C4832A]/10 to-[#A45E18]/10'
      }`}
      data-testid={src ? undefined : 'cover-banner-fallback'}
    >
      {src ? (
        <img
          src={src}
          alt=""
          onError={onError}
          className="absolute inset-0 h-full w-full object-cover"
          style={coverImageStyle(normalized)}
          draggable={false}
        />
      ) : null}
    </div>
  );
}
