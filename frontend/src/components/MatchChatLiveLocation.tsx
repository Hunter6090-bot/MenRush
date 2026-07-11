import { useEffect, useId, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Root } from 'react-dom/client';
import { createMapMarkerElement } from './MapMarker';
import { formatMatchDistanceKm } from '../lib/matchLiveLocation';
import { openMapsAt, openMapsDirections } from '../lib/maps';

interface MatchChatLiveLocationProps {
  peerName: string;
  photoUrl?: string;
  lat: number;
  lng: number;
  distanceKm?: number | string | null;
  updatedAt?: string | null;
  selfLat?: number | null;
  selfLng?: number | null;
}

function formatUpdatedAgo(iso?: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  return `Updated ${Math.floor(hrs / 24)}d ago`;
}

export function MatchChatLiveLocation({
  peerName,
  photoUrl,
  lat,
  lng,
  distanceKm,
  updatedAt,
  selfLat,
  selfLng,
}: MatchChatLiveLocationProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<{ marker: mapboxgl.Marker; root: Root } | null>(null);
  const selfMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const tokenMissing = !token || token === '__SET_ME__';
  const distanceLabel = formatMatchDistanceKm(distanceKm) ?? 'nearby';
  const updatedLabel = formatUpdatedAgo(updatedAt);

  useEffect(() => {
    setExpanded(false);
    setMapReady(false);
  }, [peerName, lat, lng]);

  useEffect(() => {
    if (!expanded || tokenMissing || !mapContainerRef.current) return;

    mapboxgl.accessToken = token!;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [lng, lat],
      zoom: 14,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      markerRef.current?.marker.remove();
      markerRef.current?.root.unmount();
      markerRef.current = null;
      selfMarkerRef.current?.remove();
      selfMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [expanded, lat, lng, token, tokenMissing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markerRef.current?.marker.remove();
    markerRef.current?.root.unmount();

    const { element, root } = createMapMarkerElement(
      {
        id: peerName,
        name: peerName,
        photo_url: photoUrl,
        isPulsing: true,
      },
      () => {},
      44,
    );
    const marker = new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
    markerRef.current = { marker, root };

    if (selfLat != null && selfLng != null && Number.isFinite(selfLat) && Number.isFinite(selfLng)) {
      if (!selfMarkerRef.current) {
        const dot = document.createElement('div');
        dot.className = 'h-3 w-3 rounded-full border-2 border-[#F0E0C0] bg-[#6FA85A] shadow-[0_0_10px_rgba(111,168,90,0.8)]';
        selfMarkerRef.current = new mapboxgl.Marker({ element: dot, anchor: 'center' })
          .setLngLat([selfLng, selfLat])
          .addTo(map);
      } else {
        selfMarkerRef.current.setLngLat([selfLng, selfLat]);
      }

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([lng, lat]);
      bounds.extend([selfLng, selfLat]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 400 });
    } else {
      map.easeTo({ center: [lng, lat], zoom: 14, duration: 400 });
      selfMarkerRef.current?.remove();
      selfMarkerRef.current = null;
    }
  }, [mapReady, lat, lng, peerName, photoUrl, selfLat, selfLng]);

  return (
    <div
      className="flex-shrink-0 border-b"
      style={{ borderColor: '#3D2B0E', background: 'rgba(196,131,42,0.08)' }}
      data-testid="match-live-location-bar"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(196,131,42,0.14)]"
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E0A14A]">Live location</p>
          <p className="mt-0.5 text-sm text-[#F0E0C0]">
            {peerName} is {distanceLabel} away
          </p>
          {updatedLabel ? (
            <p className="mt-0.5 text-[11px] text-[#A89070]">{updatedLabel}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs font-bold text-[#E0A14A]">{expanded ? 'Hide ▴' : 'Show map ▾'}</span>
      </button>

      {expanded ? (
        <div id={panelId} className="border-t border-[#3D2B0E]/80 px-4 pb-4 pt-3">
          {tokenMissing ? (
            <div className="rounded-xl border border-[#3D2B0E] bg-[#1E1508] px-4 py-6 text-center">
              <p className="text-sm font-semibold text-[#F0E0C0]">{peerName}&apos;s live location</p>
              <p className="mt-1 text-xs text-[#A89070]">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            </div>
          ) : (
            <div
              ref={mapContainerRef}
              className="h-[200px] overflow-hidden rounded-xl border border-[#3D2B0E] bg-[#11100E]"
              data-testid="match-live-location-map"
            />
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[#3D2B0E] bg-[#1E1508] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A89070]">Distance</p>
              <p className="mt-1 text-sm font-semibold text-[#F0E0C0]">{distanceLabel}</p>
            </div>
            <div className="rounded-xl border border-[#3D2B0E] bg-[#1E1508] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A89070]">Coordinates</p>
              <p className="mt-1 text-sm font-semibold text-[#F0E0C0]">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openMapsAt(lat, lng, `${peerName}'s location`)}
              className="rounded-full border border-[#C4832A]/45 bg-[#C4832A]/15 px-4 py-2 text-xs font-bold text-[#E0A14A]"
            >
              Open in maps
            </button>
            <button
              type="button"
              onClick={() => openMapsDirections(lat, lng, `${peerName}'s location`)}
              className="rounded-full bg-[#C4832A] px-4 py-2 text-xs font-bold text-[#1A0E03]"
            >
              Get directions
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}