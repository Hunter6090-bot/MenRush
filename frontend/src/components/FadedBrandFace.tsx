import { BRAND_MEDALLION_CUTOUT } from '../lib/brand';
import type { GridPhotoPhase } from '../lib/nearbyPhotoSrc';

/**
 * Brand re-signed empty face (Nearby Grid + map pins + Messages empty slots).
 *
 * Lock exactly:
 * - Asset: `/brand/medallion-transparent.png` only (official cutout)
 * - No black circle fill — filled medallion out of this empty face
 * - Zoom crop/scale so the two faces read large (CSS only; no new artwork)
 * - Fade opacity only — unmodified mark artwork
 * - Empty/missing pics only — never wipe real user photos
 * - Not a Studio post image
 *
 * Messages thread list uses this for empty/generic only (see ConversationItem).
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
 * Crop/scale so the two bronze profiles dominate the tile/pin.
 * Transparent cutout + overflow clip — logo itself must not bring a black disc.
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
