import { BRAND_MEDALLION } from '../lib/brand';
import type { GridPhotoPhase } from '../lib/nearbyPhotoSrc';

/**
 * Brand-signed empty face for Nearby Grid + map pins.
 * Official two-men medallion only — opacity fade, never redrawn or type-replaced.
 * Brand may tweak opacity later; keep a single constant.
 */
export const FADED_BRAND_FACE_OPACITY = 0.42;

/** True for missing / empty / generic avatar slots — never for real /uploads photos. */
export function isNearbyPlaceholderFace(
  photoUrl?: string | null,
  phase?: GridPhotoPhase,
): boolean {
  if (phase === 'loading' || phase === 'empty' || phase === 'fallback') return true;
  const trimmed = photoUrl?.trim() || '';
  if (!trimmed) return true;
  // Profile-setup generic SVGs and other /avatars/* are placeholders, not user media.
  if (trimmed.startsWith('/avatars/')) return true;
  return false;
}

interface FadedBrandFaceProps {
  /** Pixel size for circular map pins; omit for full-bleed grid tiles. */
  size?: number;
  className?: string;
  /** `tile` = square grid cell fill; `pin` = circular map marker. */
  variant?: 'tile' | 'pin';
  /** Accessible name (user display name). */
  label?: string;
}

export function FadedBrandFace({
  size,
  className = '',
  variant = 'tile',
  label = 'MenRush',
}: FadedBrandFaceProps) {
  const isPin = variant === 'pin';
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_28%,#2A1C0A_0%,#140E08_72%)] ${
        isPin ? 'h-full w-full rounded-full' : 'h-full w-full'
      } ${className}`}
      style={size != null ? { width: size, height: size } : undefined}
      data-testid="faded-brand-face"
      aria-label={label}
    >
      <img
        src={BRAND_MEDALLION}
        alt=""
        draggable={false}
        decoding="async"
        className={`pointer-events-none select-none object-contain ${
          isPin ? 'h-[78%] w-[78%]' : 'h-[62%] w-[62%] max-h-[140px] max-w-[140px]'
        }`}
        style={{ opacity: FADED_BRAND_FACE_OPACITY }}
      />
    </div>
  );
}
