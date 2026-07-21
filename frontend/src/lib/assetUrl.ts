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
 * Candidate URLs for an upload path — primary then same-origin / API alternate.
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

  push(getUploadAssetBaseUrl());
  push(getApiOrigin());
  if (typeof window !== 'undefined') push(window.location.origin);
  if (import.meta.env.DEV) push('http://localhost:3000');
  // Last-resort: same host as frontend/vercel.json rewrite (files live on Railway).
  push('https://backend-production-d587.up.railway.app');

  return candidates;
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
