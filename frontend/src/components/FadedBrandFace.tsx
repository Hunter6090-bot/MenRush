import { BRAND_MEDALLION_CUTOUT } from '../lib/brand';
import type { GridPhotoPhase } from '../lib/nearbyPhotoSrc';

/**
 * Brand-signed empty face for Nearby Grid + map pins.
 * Official two-men medallion cutout only — opacity fade + face zoom, never redrawn.
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

/**
 * Crop/scale so the two bronze profiles dominate.
 * Transparent cutout + overflow clip — no black disc from the logo asset.
 */
const FACE_ZOOM =
  'pointer-events-none select-none absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 max-w-none object-cover';

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
        src={BRAND_MEDALLION_CUTOUT}
        alt=""
        draggable={false}
        decoding="async"
        className={`${FACE_ZOOM} ${
          isPin
            ? 'h-[240%] w-[240%] min-h-[240%] min-w-[240%]'
            : 'h-[220%] w-[220%] min-h-[220%] min-w-[220%]'
        }`}
        style={{ opacity: FADED_BRAND_FACE_OPACITY }}
        data-faded-face-zoom={isPin ? 'pin' : 'tile'}
      />
    </div>
  );
}
