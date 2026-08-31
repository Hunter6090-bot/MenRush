/**
 * Shared responsive grid for Discover / Matches profile tiles.
 *
 * - Phone (&lt;768px): 3 columns — Brand lock (31 Aug 2026). Two-up is out.
 * - Tablet (md 768+): auto-fill min 140px → ~4 cards on iPad portrait
 *   instead of 2 giant squares filling the sheet.
 * - Desktop (lg 1024+): auto-fill min 150px in the full content column.
 *
 * Layout desktop chrome also kicks in at 1024px (`useIsDesktopLayout`).
 */
export const PROFILE_TILE_GRID_CLASS =
  'grid grid-cols-3 gap-2 md:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] lg:gap-3.5';

/** Loading skeleton cells — keep aspect close to live tiles. */
export const PROFILE_TILE_SKELETON_CLASS =
  'aspect-square animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]';
