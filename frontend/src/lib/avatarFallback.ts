import { BRAND_MEDALLION_CUTOUT } from './brand';

/**
 * ONE MenRush placeholder face (Pete lock, 6 Oct 2026).
 *
 * Every empty / missing-photo / failed-photo avatar renders the Brand-signed
 * faded medallion cutout (`FadedBrandFace` → `/brand/medallion-transparent.png`).
 * Legacy defaults (grey silhouette, initials, generic `/avatars/*` SVGs, logo
 * plates) are treated as "no photo" so they never paint again.
 *
 * MEDIA LOCK: this only decides the *fallback*. Real user uploads
 * (`/uploads/...`, signed media, blobs) are never rewritten or wiped.
 */
export const BRAND_PLACEHOLDER_AVATAR = BRAND_MEDALLION_CUTOUT;

const LEGACY_DEFAULT_AVATAR_PATTERNS: RegExp[] = [
  // Shared generic SVG pool + any other /avatars/* default (relative or absolute).
  /^\/avatars\//i,
  /^https?:\/\/[^/]+\/avatars\//i,
  // Brand chrome / old logo plates are never a person's photo.
  /^\/brand\//i,
  /^https?:\/\/[^/]+\/brand\//i,
  /menrush-logo[^/]*\.(png|jpe?g|webp|svg)(\?.*)?$/i,
  /^(https?:\/\/[^/]+)?\/logo\.(png|jpe?g|webp|svg)(\?.*)?$/i,
  /^(https?:\/\/[^/]+)?\/images\/logo\.(png|jpe?g|webp|svg)(\?.*)?$/i,
  // Generic default-avatar names + third-party initials services.
  /default[-_]?avatar/i,
  /default[-_]?profile/i,
  /avatar[-_]?placeholder/i,
  /ui-avatars\.com/i,
  /gravatar\.com\/avatar/i,
];

/** True for a legacy default image (generic SVG, logo plate, initials service). */
export function isLegacyDefaultAvatarUrl(url?: string | null): boolean {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return false;
  return LEGACY_DEFAULT_AVATAR_PATTERNS.some((re) => re.test(trimmed));
}

/** True when there is no real user photo to show (empty or legacy default). */
export function isPlaceholderAvatarUrl(url?: string | null): boolean {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return true;
  return isLegacyDefaultAvatarUrl(trimmed);
}

/** Real user photo path, or null when the Brand placeholder should render. */
export function realAvatarUrl(url?: string | null): string | null {
  if (isPlaceholderAvatarUrl(url)) return null;
  return String(url).trim();
}
