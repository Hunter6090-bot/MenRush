# Nearby map library swap brief (contingency)

Owner lock: soft continuous pan/pinch on **Android Chrome and iPhone**, across empty map and HTML pins/Hot Spots. Prefer fixing Mapbox first (`pointer-events: none` markers + canvas-owned `dragPan` / `touchZoomRotate`). Use this brief only if that bar still fails on device after the canvas-owned gesture PR.

## Why swap (only if Mapbox ceiling confirmed)

Shared root cause on both platforms (not iOS-only): HTML markers above the GL canvas steal touches; JS `panBy` forwarding (#224) has no native inertia. If canvas-owned markers still feel sticky on Android + iPhone after an honest Mapbox pass, the library itself is the ceiling — do not ship another CSS `touch-action` patch.

## Keep (product surface)

| Surface | Behavior to preserve |
| --- | --- |
| People pins | Face avatars, Pulse glow, obfuscated ~100–300 m positions |
| Self pin | Own face; tap → `/profile` |
| Hot Spots / Cruise | Layer toggle, occupied vs empty pin, in-map sheet |
| Live | Online presence count — never radius label |
| Radius | Dashed circle + ProximitySlider |
| Shell | Grid↔Map, expand/shrink, no parent rubber-band |

## Candidates

| Lib | Mobile gestures | PWA | Pins / Hot Spots / Live / radius | Cost |
| --- | --- | --- | --- | --- |
| **MapLibre GL JS** | Same GL handler model as Mapbox; best drop-in | Strong | High — Marker HTML + GeoJSON radius port | Medium — package, style URL, drop Mapbox token |
| **Google Maps JS** | Strong Android + iOS WebView | Strong | Medium — OverlayView for faces; Cruise + radius rewrite | High — billing, ToS, privacy re-check |
| **Apple MapKit JS** | Safari-strong | Weak for Android + installed PWA | Low–medium | High — fails Android; not a PWA answer |

**Recommendation if swapping:** MapLibre GL JS first. Same mental model as current Discover code (`Marker`, GeoJSON source/layer, `dragPan` / `touchZoomRotate`). Google only if MapLibre also fails the soft-continuous bar on Android. Do not pick MapKit as the primary PWA map.

## Migration steps (MapLibre)

1. Replace `mapbox-gl` with `maplibre-gl`; swap CSS import.
2. Point style at a MapLibre-compatible basemap (no Mapbox token).
3. Keep `mapMarkerHitTest` + canvas pass-through contract — do not revive #224 panBy forwarding.
4. Port radius GeoJSON layer ids; Cruise + people marker factories unchanged in structure.
5. E2E: touch pan across pin moves center; pinch changes zoom; expand/shell; Live honesty.
6. BOA90: Android Chrome + iPhone — drag empty, drag across pins, pinch, expand.

## Starter scaffold (when Product routes the swap)

- New branch off main: `cursor/maplibre-nearby-scaffold-*`
- Touch: `frontend/package.json` dep, `mapboxLazy.ts` → `mapLibreLazy.ts`, `Discover.tsx` imports, `mapTheme.ts` style URL
- Leave pins/Hot Spots/Live/radius behavior behind the same React factories (`MapMarker`, `HotSpotPin`, hit-test)
- Do not mix public copy or media wipe
