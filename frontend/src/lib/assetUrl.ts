/**
 * Resolve profile / media asset URLs.
 *
 * - `/avatars/*` always loads from the frontend origin (Vite public/).
 * - `/uploads/*` and `/api/...` load from the **API host** when VITE_API_URL is absolute
 *   (same Railway box that stored the file). Falls back to same-origin (Vercel rewrite)
 *   or VITE_ASSET_URL when set.
 * - Never use VITE_SOCKET_URL for avatars (that host does not serve them).
 */

function sanitizeEnvUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  while (s.endsWith('\\n') || s.endsWith('\\r')) {
    s = s.slice(0, -2).trimEnd();
  }
  return s.replace(/[\r\n]+/g, '').trim();
}

/** API origin (no trailing /api) when VITE_API_URL is absolute. */
export function getApiOrigin(): string | undefined {
  const api = sanitizeEnvUrl(import.meta.env.VITE_API_URL);
  if (!/^https?:\/\//i.test(api)) return undefined;
  try {
    return new URL(api).origin;
  } catch {
    return undefined;
  }
}

export function getUploadAssetBaseUrl(): string {
  const configured = sanitizeEnvUrl(import.meta.env.VITE_ASSET_URL).replace(/\/$/, '');
  if (configured) return configured;

  // Prefer the backend origin that accepted the multipart upload. Vercel rewrite
  // targets can drift from VITE_API_URL and then every /uploads/* 404s → generic egg.
  const apiOrigin = getApiOrigin();
  if (apiOrigin) return apiOrigin;

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

/**
 * Candidate URLs for an upload path — same-origin rewrite first on Vercel
 * (avoids failed Railway walks on iPhone), then API origin / fallbacks.
 * Image components should walk these on onError before falling back to generic SVG.
 */
export function resolveUploadUrlCandidates(url?: string | null): string[] {
  if (!url) return [];
  const trimmed = String(url).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return [trimmed];
  }
  if (trimmed.startsWith('/avatars/')) {
    const resolved = resolveAssetUrl(trimmed);
    return resolved ? [resolved] : [];
  }
  if (!isUploadPath(trimmed) && !trimmed.startsWith('/api/')) {
    const resolved = resolveAssetUrl(trimmed);
    return resolved ? [resolved] : [];
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const candidates: string[] = [];
  const push = (origin: string | undefined) => {
    if (!origin) return;
    const full = `${origin.replace(/\/$/, '')}${path}`;
    if (!candidates.includes(full)) candidates.push(full);
  };

  // Prefer same-origin (Vercel /uploads rewrite) before absolute Railway —
  // iPhone was walking dead Railway URLs and leaving Nearby tiles blank.
  if (typeof window !== 'undefined') push(window.location.origin);
  push(getUploadAssetBaseUrl());
  push(getApiOrigin());
  if (import.meta.env.DEV) push('http://localhost:3000');
  // Last-resort: same host as frontend/vercel.json rewrite (files live on Railway).
  push('https://backend-production-d587.up.railway.app');

  return candidates;
}

const DISPLAY_THUMB_PREFIXES = ['/uploads/profiles/', '/uploads/messages/', '/uploads/albums/', '/uploads/room-temp/'];

/** True when GET /api/media/display can resize this path. */
export function canUseDisplayThumb(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = String(url).trim();
  if (!trimmed.startsWith('/uploads/')) return false;
  return DISPLAY_THUMB_PREFIXES.some((p) => trimmed.startsWith(p));
}

/**
 * Downscaled JPEG candidates via `/api/media/display` (for Nearby / Matches grids).
 * Falls back to full upload candidates so a missing thumb never blanks the tile.
 */
export function resolveDisplayThumbCandidates(
  url?: string | null,
  width = 480,
): string[] {
  if (!url) return [];
  const trimmed = String(url).trim();
  if (!canUseDisplayThumb(trimmed)) {
    return resolveUploadUrlCandidates(trimmed);
  }

  const w = Math.min(Math.max(Math.round(width) || 480, 64), 1280);
  const srcParam = encodeURIComponent(trimmed);
  const displayPath = `/api/media/display?src=${srcParam}&w=${w}`;
  const thumbs: string[] = [];
  const push = (origin: string | undefined) => {
    if (!origin) return;
    const full = `${origin.replace(/\/$/, '')}${displayPath}`;
    if (!thumbs.includes(full)) thumbs.push(full);
  };

  if (typeof window !== 'undefined') push(window.location.origin);
  push(getApiOrigin());
  push(getUploadAssetBaseUrl());
  if (import.meta.env.DEV) push('http://localhost:3000');
  push('https://backend-production-d587.up.railway.app');

  return [...thumbs, ...resolveUploadUrlCandidates(trimmed)];
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
