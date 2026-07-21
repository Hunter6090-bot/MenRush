/**
 * Appearance: light | dark | system.
 * Persists to localStorage; resolves system via prefers-color-scheme.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'menrush_theme';
export const THEME_CHANGED_EVENT = 'menrush:theme-changed';

const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'system'];

export function readThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* private mode */
  }
  return 'system';
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

export function applyTheme(pref: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('theme-light', resolved === 'light');
  root.classList.toggle('theme-dark', resolved === 'dark');
  root.style.colorScheme = resolved;

  // Keep <body> inline styles in sync — index.html boots with dark defaults that
  // would otherwise make Messages/full-screen shells look like theme reverted.
  if (document.body) {
    document.body.style.background = resolved === 'light' ? '#F5EDE0' : '#0D0A06';
    document.body.style.color = resolved === 'light' ? '#1A1208' : '#F0E0C0';
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#F5EDE0' : '#0D0A06');
  }
  return resolved;
}

function notifyThemeChanged(pref: ThemePreference): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGED_EVENT, { detail: { preference: pref } }),
  );
}

export function setThemePreference(pref: ThemePreference): ResolvedTheme {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
  const resolved = applyTheme(pref);
  notifyThemeChanged(pref);
  return resolved;
}

/** Cycle light → dark → system → light. */
export function cycleThemePreference(): ThemePreference {
  const current = readThemePreference();
  const idx = THEME_CYCLE.indexOf(current);
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
  setThemePreference(next);
  return next;
}

export function themePreferenceLabel(pref: ThemePreference): string {
  if (pref === 'light') return 'Light';
  if (pref === 'dark') return 'Dark';
  return 'System';
}

export function initThemeFromStorage(): ResolvedTheme {
  return applyTheme(readThemePreference());
}
