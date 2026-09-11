import { BRAND_MEDALLION_CUTOUT } from '../lib/brand';
import type { GridPhotoPhase } from '../lib/nearbyPhotoSrc';

/**
 * Brand empty face — transparent two-men cutout only (`/brand/medallion-transparent.png`).
 *
 * Surfaces (owner refine):
 * - `pin` (map): whole circular logo visible — no face-zoom crop
 * - `profile`: same avatar size as today; slight crop-down + slightly brighter
 * - `tile` (Nearby Grid): crop-down (more faces) + brighter
 *
 * Empty/missing / `/avatars/*` only — never wipe real `/uploads` photos.
 * No MENRUSH type; no filled black disc.
 */
/** Nearby Grid — brighter than the original 0.42 fade so faces read. */
export const FADED_BRAND_FACE_OPACITY_TILE = 0.55;
/** Profile empty — slightly brighter than the original fade. */
export const FADED_BRAND_FACE_OPACITY_PROFILE = 0.55;
/** Map pin — readable full logo on the map. */
export const FADED_BRAND_FACE_OPACITY_PIN = 0.58;
/** @deprecated Prefer variant-specific constants. */
export const FADED_BRAND_FACE_OPACITY = FADED_BRAND_FACE_OPACITY_PIN;

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

export type FadedBrandFaceVariant = 'tile' | 'pin' | 'profile';

interface FadedBrandFaceProps {
  /** Pixel size for circular pins / profile; omit for full-bleed grid tiles. */
  size?: number;
  className?: string;
  /**
   * `tile` = Nearby Grid cell (face zoom, crop down, brighter)
   * `pin` = map marker (whole circular logo, not clipped)
   * `profile` = Profile empty avatar (face zoom, slight crop down, brighter)
   */
  variant?: FadedBrandFaceVariant;
  /** Accessible name (user display name). */
  label?: string;
}

const FACE_ZOOM_BASE =
  'pointer-events-none select-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none object-cover';

export function FadedBrandFace({
  size,
  className = '',
  variant = 'tile',
  label = 'MenRush',
}: FadedBrandFaceProps) {
  const isPin = variant === 'pin';
  const isProfile = variant === 'profile';
  const isTile = variant === 'tile';

  const opacity = isPin
    ? FADED_BRAND_FACE_OPACITY_PIN
    : isProfile
      ? FADED_BRAND_FACE_OPACITY_PROFILE
      : FADED_BRAND_FACE_OPACITY_TILE;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_28%,#2A1C0A_0%,#140E08_72%)] ${
        isPin || isProfile ? 'h-full w-full rounded-full' : 'h-full w-full'
      } ${className}`}
      style={size != null ? { width: size, height: size } : undefined}
      data-testid="faded-brand-face"
      data-faded-variant={variant}
      aria-label={label}
    >
      {isPin ? (
        // Map: whole circular medallion fits inside the pin — not face-cropped.
        <img
          src={BRAND_MEDALLION_CUTOUT}
          alt=""
          draggable={false}
          decoding="async"
          className="pointer-events-none select-none h-[92%] w-[92%] object-contain"
          style={{ opacity }}
          data-faded-face-zoom="pin-full"
        />
      ) : (
        <img
          src={BRAND_MEDALLION_CUTOUT}
          alt=""
          draggable={false}
          decoding="async"
          className={`${FACE_ZOOM_BASE} ${
            isProfile
              ? // Profile: slight crop-down from the old 40% face center.
                'top-[48%] h-[220%] w-[220%] min-h-[220%] min-w-[220%]'
              : // Grid tile: push crop further down so more of both faces show.
                'top-[55%] h-[220%] w-[220%] min-h-[220%] min-w-[220%]'
          }`}
          style={{ opacity }}
          data-faded-face-zoom={isTile ? 'tile' : 'profile'}
        />
      )}
    </div>
  );
}
