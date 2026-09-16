/**
 * Resolve profile / media asset URLs.
 *
 * - `/avatars/*` always loads from the frontend origin (Vite public/).
 * - `/uploads/*` and `/api/...` load from the **API host** when VITE_API_URL is absolute
 *   (same Railway box that stored the file). Falls back to same-origin (Vercel rewrite)
 *   or VITE_ASSET_URL when set.
 * - Never use VITE_SOCKET_URL for avatars (that host does not serve them).
 *
 * Production lock: menrush.com Vercel rewrites MUST target RAILWAY_PRODUCTION_ORIGIN
 * (see frontend/vercel.json). #97 briefly pointed rewrites at staging and blanked
 * every face — keep this origin in sync with vercel.json.
 */

/** Railway production API host — volume where live /uploads photos live. */
export const RAILWAY_PRODUCTION_ORIGIN = 'https://backend-production-d587.up.railway.app';

function sanitizeEnvUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  while (s.endsWith('\\n') || s.endsWith('\\r')) {
    s = s.slice(0, -2).trimEnd();
  }
  return s.replace(/[\r\n]+/g, '').trim();
}

/** True on the public production site (not local / preview aliases). */
export function isMenrushProductionHost(hostname?: string): boolean {
  const host =
    hostname ??
    (typeof window !== 'undefined' ? window.location.hostname : '');
  return host === 'menrush.com' || host === 'www.menrush.com';
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

  // Public production site: always the Railway production volume (matches vercel.json).
  // Must win over a relative/absolute VITE_API_URL so a bad rewrite or local-shaped
  // env cannot blank faces on menrush.com (#97 staging rewrite regression).
  if (typeof window !== 'undefined' && isMenrushProductionHost()) {
    return RAILWAY_PRODUCTION_ORIGIN;
  }

  // Prefer the backend origin that accepted the multipart upload.
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

  // Public marketing / fixture images ship with the Vite app, not the API.
  if (trimmed.startsWith('/images/') || trimmed.startsWith('/brand/')) {
    const origin = getFrontendOrigin();
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  // Signed chat media (`/api/messages/.../media?access=`) — keep same-origin so
  // Vercel rewrite + Safari byte-range play on one host (absolute Railway URLs
  // made iPhone video open ~12s after the message already arrived).
  if (trimmed.startsWith('/api/')) {
    return trimmed;
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
  if (trimmed.startsWith('/images/') || trimmed.startsWith('/brand/')) {
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

  // On menrush.com, prefer Railway production first (files live on that volume).
  // Same-origin Vercel rewrite is second — it 404s if rewrites drift to staging (#97).
  if (typeof window !== 'undefined' && isMenrushProductionHost()) {
    push(RAILWAY_PRODUCTION_ORIGIN);
    push(window.location.origin);
  } else if (typeof window !== 'undefined') {
    push(window.location.origin);
  }
  push(getUploadAssetBaseUrl());
  push(getApiOrigin());
  if (import.meta.env.DEV) push('http://localhost:3000');
  // Last-resort: Railway production (matches frontend/vercel.json).
  push(RAILWAY_PRODUCTION_ORIGIN);

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

  if (typeof window !== 'undefined' && isMenrushProductionHost()) {
    push(RAILWAY_PRODUCTION_ORIGIN);
    push(window.location.origin);
  } else if (typeof window !== 'undefined') {
    push(window.location.origin);
  }
  push(getApiOrigin());
  push(getUploadAssetBaseUrl());
  if (import.meta.env.DEV) push('http://localhost:3000');
  push(RAILWAY_PRODUCTION_ORIGIN);

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
