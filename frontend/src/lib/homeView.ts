/**
 * Home view preference for redesign Step 1: map | list (default map).
 * Kept in sync with NearbyView (map | grid) so Discover and the bottom-tab
 * toggle share one setting.
 */
import type { NearbyView } from '../components/NearbyMapGridToggle';
import { readNearbyView, writeNearbyView } from '../components/NearbyMapGridToggle';

export type HomeView = 'map' | 'list';

export const HOME_VIEW_KEY = 'menrush_home_view';
export const HOME_VIEW_EVENT = 'menrush:home-view';

export function nearbyToHomeView(view: NearbyView): HomeView {
  return view === 'grid' ? 'list' : 'map';
}

export function homeViewToNearby(view: HomeView): NearbyView {
  return view === 'list' ? 'grid' : 'map';
}

export function readHomeView(): HomeView {
  try {
    const raw = localStorage.getItem(HOME_VIEW_KEY);
    if (raw === 'map' || raw === 'list') return raw;
  } catch {
    /* ignore */
  }
  // Migrate from NearbyMapGridToggle storage when home key is unset.
  return nearbyToHomeView(readNearbyView());
}

export function writeHomeView(view: HomeView): void {
  try {
    localStorage.setItem(HOME_VIEW_KEY, view);
  } catch {
    /* ignore */
  }
  writeNearbyView(homeViewToNearby(view));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HOME_VIEW_EVENT, { detail: view }));
  }
}

/** Label + purpose of the first bottom-tab slot: always the *other* view. */
export function homeToggleTarget(current: HomeView): HomeView {
  return current === 'map' ? 'list' : 'map';
}

export function homeToggleLabel(current: HomeView): 'List' | 'Map' {
  return homeToggleTarget(current) === 'list' ? 'List' : 'Map';
}
