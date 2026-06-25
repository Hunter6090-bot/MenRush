/** Base URL for static uploads (/uploads/profiles, signed media paths, etc.). */
export function getAssetBaseUrl(): string {
  const configured = String(import.meta.env.VITE_SOCKET_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return import.meta.env.DEV ? 'http://localhost:3000' : '';
}

export function resolveAssetUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${getAssetBaseUrl()}${url}`;
}
