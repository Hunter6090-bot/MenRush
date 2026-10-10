/**
 * You tab rows (Claude Design board "07 You / settings", Pete lock 10 Oct 2026).
 *
 * One small config drives the "Coming soon" tags. A row whose feature is not
 * built yet stays on the board in its place, shows a muted "Coming soon" tag,
 * and opens a short notice instead of navigating anywhere. When a feature goes
 * live, flip it to 'live' here and give the row a real destination.
 *
 * Evidence (origin/main, 10 Oct 2026):
 * - Quiet hours: no quiet hours / do not disturb schedule in NotificationSettings,
 *   the push service or any migration. Only mentioned in docs/redesign-2026-10/feature-map.md.
 * - Merch: no shop, product or merch route, page or table.
 * - Brands: no brands route, page or table (Settings.ia.test asserts no Brands row).
 */
export type YouFeatureStatus = 'live' | 'coming_soon';

export type YouRowId =
  | 'albums'
  | 'discretion'
  | 'quiet-hours'
  | 'two-factor'
  | 'settings'
  | 'merch'
  | 'brands';

export const YOU_FEATURE_STATUS: Record<YouRowId, YouFeatureStatus> = {
  albums: 'live',
  discretion: 'live',
  'quiet-hours': 'coming_soon',
  'two-factor': 'live',
  settings: 'live',
  merch: 'coming_soon',
  brands: 'coming_soon',
};

export interface YouRowDef {
  id: YouRowId;
  label: string;
  /** In-app route for live rows that navigate. Discretion opens a sheet instead. */
  to?: string;
}

/** Board order. Card 1 then card 2. Sign out sits below both cards. */
export const YOU_ROW_CARDS: YouRowDef[][] = [
  [
    { id: 'albums', label: 'Albums', to: '/albums' },
    { id: 'discretion', label: 'Discretion' },
    { id: 'quiet-hours', label: 'Quiet hours' },
    { id: 'two-factor', label: '2FA', to: '/settings#two-factor' },
    { id: 'settings', label: 'Settings', to: '/settings' },
  ],
  [
    { id: 'merch', label: 'Merch' },
    { id: 'brands', label: 'Brands' },
  ],
];

export function isComingSoon(id: YouRowId): boolean {
  return YOU_FEATURE_STATUS[id] === 'coming_soon';
}

/** Short notice for a Coming soon row. No dates, nothing that pretends it works. */
export function comingSoonNotice(label: string): string {
  return `${label} is coming soon.`;
}

/** Edit screen for everything that used to sit on the You page. */
export const PROFILE_EDIT_PATH = '/profile/edit';

/** The You rows screen (bottom tab You). */
export const YOU_ROWS_PATH = '/profile';

/**
 * Zoul (10 Oct 2026): the app-wide location and profile-depth strips stay off the
 * You rows screen only, so the rows sit above the fold at 390px as on the board.
 * The Edit screen and every other route still show them.
 */
export function isYouRowsPath(pathname: string): boolean {
  return pathname === YOU_ROWS_PATH || pathname === `${YOU_ROWS_PATH}/`;
}
