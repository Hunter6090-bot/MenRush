/** Lazy-load mapbox so Discover list paint is not blocked by the ~1.7MB GL chunk. */
type MapboxNS = typeof import('mapbox-gl').default;

let mapboxPromise: Promise<MapboxNS> | null = null;
let mapboxLoaded: MapboxNS | null = null;

export function loadMapbox(): Promise<MapboxNS> {
  if (!mapboxPromise) {
    mapboxPromise = Promise.all([
      import('mapbox-gl'),
      import('mapbox-gl/dist/mapbox-gl.css'),
    ]).then(([mod]) => {
      mapboxLoaded = mod.default;
      return mod.default;
    });
  }
  return mapboxPromise;
}

/** Available after `loadMapbox()` resolves (mapLoaded UI gate). */
export function getLoadedMapbox(): MapboxNS | null {
  return mapboxLoaded;
}
