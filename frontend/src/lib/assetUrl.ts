/**
 * Resolve profile / media asset URLs.
 *
 * - `/avatars/*` always loads from the frontend origin (Vite public/).
 * - `/uploads/*` and `/api/...` load from same origin (Vercel rewrites to Railway)
 *   unless VITE_ASSET_URL is set.
 * - Never use VITE_SOCKET_URL for avatars (that host does not serve them).
 */

export function getUploadAssetBaseUrl(): string {
  const configured = String(import.meta.env.VITE_ASSET_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  // Dev fallback: backend serves /uploads
  return import.meta.env.DEV ? 'http://localhost:3000' : '';
}

export function getFrontendOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function resolveAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Shared generic SVGs live on the frontend CDN / Vercel, not the API host.
  if (trimmed.startsWith('/avatars/')) {
    const origin = getFrontendOrigin();
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  const base = getUploadAssetBaseUrl();
  return `${base}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

/** True when the path looks like a local upload that may be missing on disk. */
export function isUploadPath(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith('/uploads/') || url.includes('/uploads/');
}

/** Prefer a working generic if we know the upload is broken (client-side after onError). */
export function fallbackAvatarForAge(age?: number): string {
  if (age != null && age >= 45) return '/avatars/generic/09.svg';
  if (age != null && age >= 30) return '/avatars/generic/05.svg';
  return '/avatars/generic/02.svg';
}
