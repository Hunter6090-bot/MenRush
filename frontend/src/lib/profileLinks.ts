const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const REDIRECT_KEY = 'menrush:redirect';

export function parseProfileId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(
      trimmed,
      typeof window !== 'undefined' ? window.location.origin : 'https://menrush.com',
    );
    const pathMatch = url.pathname.match(/\/profile\/([^/?#]+)/i);
    const fromPath = pathMatch?.[1]?.match(UUID_RE)?.[0];
    if (fromPath) return fromPath;
  } catch {
    // Not a URL — fall through to raw UUID match.
  }

  return trimmed.match(UUID_RE)?.[0] ?? null;
}

export function profilePath(id: string): string {
  return `/profile/${id}`;
}

export function profileShareBase(): string {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://menrush.com';
}

export function profileUrl(id: string): string {
  return `${profileShareBase()}${profilePath(id)}`;
}

export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  if (next.startsWith('/login') || next.startsWith('/register')) return null;
  return next;
}

export function savePostAuthRedirect(path: string): void {
  const safe = safeNextPath(path);
  if (!safe) return;
  sessionStorage.setItem(REDIRECT_KEY, safe);
}

export function consumePostAuthRedirect(fallback = '/discover'): string {
  const saved = safeNextPath(sessionStorage.getItem(REDIRECT_KEY));
  sessionStorage.removeItem(REDIRECT_KEY);
  return saved || fallback;
}
