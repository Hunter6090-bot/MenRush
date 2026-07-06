/** GeoJSON polygon approximating a circle for Mapbox dashed radius rings. */
export function geoJsonCircle(
  centerLng: number,
  centerLat: number,
  radiusKm: number,
  points = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const kmPerDegreeLat = 110.574;
  const kmPerDegreeLng = 111.32 * Math.cos((centerLat * Math.PI) / 180);
  const dx = radiusKm / kmPerDegreeLng;
  const dy = radiusKm / kmPerDegreeLat;

  for (let i = 0; i <= points; i += 1) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([centerLng + dx * Math.cos(theta), centerLat + dy * Math.sin(theta)]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

export const RADIUS_CIRCLE_SOURCE = 'menrush-radius-circle';
export const RADIUS_CIRCLE_LAYER = 'menrush-radius-circle-line';
