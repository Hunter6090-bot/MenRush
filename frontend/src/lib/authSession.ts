/**
 * Auth session persistence for browser + installed PWA.
 *
 * Tokens live in localStorage (primary). A SameSite=Lax cookie mirror backs up
 * cold-start races on some WebViews where the first localStorage read can be
 * empty, and AppShell must rehydrate — never wipe — when the store is empty but
 * storage still has a session.
 */

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const COOKIE_NAME = 'mr_token';
/** Match backend JWT TTL (7 days). */
const COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;

export type StoredAuthUser = {
  id: string;
  email: string;
  name: string;
  age?: number;
  bio?: string;
  photo_url?: string;
  is_verified?: boolean;
  verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
  is_premium?: boolean;
  premium_tier?: 'free' | 'premium' | 'premium_plus';
  beta_premium_included?: boolean;
};

function isPlausibleToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const t = token.trim();
  if (t.length < 16) return false;
  if (t === 'null' || t === 'undefined') return false;
  return t.includes('.');
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const parts = document.cookie.split(';');
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx < 0) continue;
      const key = part.slice(0, idx).trim();
      if (key !== name) continue;
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeTokenCookie(token: string): void {
  if (typeof document === 'undefined') return;
  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  } catch {
    /* ignore */
  }
}

function clearTokenCookie(): void {
  if (typeof document === 'undefined') return;
  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    /* ignore */
  }
}

export function readStoredToken(): string | null {
  try {
    const fromLs = localStorage.getItem(TOKEN_KEY);
    if (isPlausibleToken(fromLs)) return fromLs.trim();
  } catch {
    /* private mode */
  }
  const fromCookie = readCookie(COOKIE_NAME);
  if (isPlausibleToken(fromCookie)) {
    // Heal localStorage from cookie so subsequent reads are fast.
    try {
      localStorage.setItem(TOKEN_KEY, fromCookie.trim());
    } catch {
      /* ignore */
    }
    return fromCookie.trim();
  }
  return null;
}

export function readStoredUser(): StoredAuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuthUser;
  } catch {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function persistAuthSession(user: StoredAuthUser, token: string): void {
  const t = token.trim();
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* quota / private mode — cookie mirror may still help */
  }
  writeTokenCookie(t);
}

export function persistAuthUser(user: StoredAuthUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  clearTokenCookie();
}

/** Snapshot for rehydrating Zustand when storage has a session the store lost. */
export function readAuthSnapshot(): { user: StoredAuthUser | null; token: string | null } {
  const token = readStoredToken();
  if (!token) return { user: null, token: null };
  return { user: readStoredUser(), token };
}
