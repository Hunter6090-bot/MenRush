/**
 * First-launch 18+ gate (board screen 01, Zoul 10 Oct 2026).
 *
 * A self-declared "I'm 18 or over" tap, remembered on this device only. It is
 * not age verification and nothing in the copy may say it is.
 */
export const AGE_GATE_STORAGE_KEY = 'menrush_age_gate_v1';
export const AGE_GATE_ADULT_VALUE = 'adult';

/**
 * Pages anyone can reach without the gate (lock: public pages and deep links
 * stay reachable): the homepage, /pride, legal and help pages, and the invite
 * and register entry points. Everything else (sign in and the app) shows the
 * gate once per device.
 */
export const UNDER_18_EXIT_PATH = '/under-18';
const PUBLIC_EXACT = new Set([
  '/',
  '/coming-soon',
  '/get-the-app',
  '/install',
  '/terms',
  '/privacy',
  '/cookies',
  '/contact',
  '/safety',
  '/guidelines',
  '/help',
  '/invite',
  '/beta',
  UNDER_18_EXIT_PATH,
]);
const PUBLIC_PREFIXES = ['/pride', '/brightonpride', '/register'];

export function isAgeGateExemptPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** In-memory fallback for browsers that block storage (Safari private mode). */
let memoryAnswer: string | null = null;

export function hasConfirmedAdult(): boolean {
  if (memoryAnswer === AGE_GATE_ADULT_VALUE) return true;
  try {
    return window.localStorage.getItem(AGE_GATE_STORAGE_KEY) === AGE_GATE_ADULT_VALUE;
  } catch {
    return false;
  }
}

export function rememberConfirmedAdult(): void {
  memoryAnswer = AGE_GATE_ADULT_VALUE;
  try {
    window.localStorage.setItem(AGE_GATE_STORAGE_KEY, AGE_GATE_ADULT_VALUE);
  } catch {
    /* storage blocked: the answer lasts for this session only */
  }
}

/** Test helper. */
export function resetAgeGateMemoryForTests(): void {
  memoryAnswer = null;
}
