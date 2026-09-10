/**
 * STARTER SCAFFOLD ONLY — not wired. Product routes the MapLibre swap separately
 * if Mapbox still fails soft continuous pan/pinch on Android + iPhone after the
 * canvas-owned gesture fix. See docs/map-library-swap-brief.md.
 *
 * Migration sketch:
 * 1) npm i maplibre-gl && remove mapbox-gl
 * 2) Rename this file to mapLibreLazy.ts and point Discover imports here
 * 3) Keep mapMarkerHitTest + pointer-events:none markers (do not revive #224 panBy)
 * 4) Swap style URL in mapTheme.ts to a MapLibre basemap (no Mapbox token)
 */
export async function loadMapLibreScaffold(): Promise<never> {
  throw new Error(
    'MapLibre scaffold is not enabled. Enable only after Product routes the map swap.',
  );
}
