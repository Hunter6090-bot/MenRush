import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createMapMarkerElement } from './MapMarker';
import type { Root } from 'react-dom/client';
import { openMapsDirections } from '../lib/maps';
import { formatDistanceFromKm } from '../lib/localeUnits';

export interface MatchMapPin {
  id: string;
  name: string;
  photo_url?: string;
  lat: number;
  lng: number;
  distance_km?: number | string | null;
}

interface MatchesLiveMapProps {
  matches: MatchMapPin[];
  selfLat?: number | null;
  selfLng?: number | null;
  onSelectMatch?: (matchId: string) => void;
}

export function MatchesLiveMap({
  matches,
  selfLat,
  selfLng,
  onSelectMatch,
}: MatchesLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; root: Root }>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const tokenMissing = !token || token === '__SET_ME__';

  useEffect(() => {
    if (tokenMissing || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [selfLng ?? -0.1365, selfLat ?? 51.5136],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach(({ marker, root }) => {
        marker.remove();
        root.unmount();
      });
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [token, tokenMissing, selfLat, selfLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const visibleIds = new Set(matches.map((m) => m.id));

    markersRef.current.forEach((entry, id) => {
      if (!visibleIds.has(id)) {
        entry.marker.remove();
        entry.root.unmount();
        markersRef.current.delete(id);
      }
    });

    const bounds = new mapboxgl.LngLatBounds();

    if (selfLat != null && selfLng != null) {
      bounds.extend([selfLng, selfLat]);
    }

    for (const match of matches) {
      bounds.extend([match.lng, match.lat]);
      const existing = markersRef.current.get(match.id);
      if (existing) {
        existing.marker.setLngLat([match.lng, match.lat]);
        continue;
      }

      const { element, root } = createMapMarkerElement(
        {
          id: match.id,
          name: match.name,
          photo_url: match.photo_url,
          isPulsing: true,
        },
        () => onSelectMatch?.(match.id),
        40,
      );
      const marker = new mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([match.lng, match.lat])
        .addTo(map);
      markersRef.current.set(match.id, { marker, root });
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 500 });
    }
  }, [matches, mapReady, onSelectMatch, selfLat, selfLng]);

  if (tokenMissing) {
    return (
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-6 text-center">
        <p className="text-sm font-semibold text-[var(--cream)]">Live match map unavailable</p>
        <p className="mt-1 text-xs text-[var(--cream-muted)]">
          {matches.length} match{matches.length === 1 ? '' : 'es'} sharing location — open a chat for directions.
        </p>
      </div>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[#11100E] shadow-[var(--shadow-md)]">
      <div ref={containerRef} className="h-[220px] w-full lg:h-[280px]" data-testid="matches-live-map" />
      <div className="flex flex-wrap gap-2 border-t border-[var(--border-default)] px-3 py-2.5">
        {matches.map((match) => (
          <button
            key={match.id}
            type="button"
            onClick={() => {
              openMapsDirections(match.lat, match.lng, match.name);
              onSelectMatch?.(match.id);
            }}
            className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] font-bold text-[var(--cream-soft)] transition-colors hover:border-[var(--copper)]/40"
          >
            {match.name}
            {match.distance_km != null ? ` · ${formatDistanceFromKm(Number(match.distance_km))}` : ''}
          </button>
        ))}
      </div>
    </div>
  );
}