/**
 * Theme-aware Mapbox basemap selection.
 *
 * Discover/HotSpots previously hardcoded `dark-v11` regardless of the app's
 * light/dark setting, leaving a dark map embedded in an otherwise light UI.
 * This mirrors `lib/theme.ts`'s resolution (light | dark | system) so the
 * basemap always matches what the rest of the authenticated app is showing.
 */
import { readThemePreference, resolveTheme, THEME_CHANGED_EVENT, type ResolvedTheme } from './theme';

export { THEME_CHANGED_EVENT };

const MAPBOX_STYLE: Record<ResolvedTheme, string> = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

export function mapboxStyleForTheme(theme: ResolvedTheme): string {
  return MAPBOX_STYLE[theme];
}

export function resolvedThemeNow(): ResolvedTheme {
  return resolveTheme(readThemePreference());
}
