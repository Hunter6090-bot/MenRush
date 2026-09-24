import { useState } from 'react';
import { getMapboxStaticThumbnailUrl } from '../lib/cruising';
import { resolvedThemeNow } from '../lib/mapTheme';

interface CruisingSpotMapThumbnailProps {
  latitude: number;
  longitude: number;
  name: string;
  className?: string;
}

export function CruisingSpotMapThumbnail({
  latitude,
  longitude,
  name,
  className = '',
}: CruisingSpotMapThumbnailProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const currentTheme = resolvedThemeNow();
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

  const staticUrl = !imgFailed
    ? getMapboxStaticThumbnailUrl(latitude, longitude, mapboxToken, currentTheme)
    : null;

  return (
    <div
      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[#14120E] sm:h-24 sm:w-24 ${className}`}
      data-testid="cruising-map-thumbnail"
      aria-hidden="true"
    >
      {staticUrl ? (
        <img
          src={staticUrl}
          alt={`Map preview of ${name}`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="relative flex h-full w-full flex-col items-center justify-center p-1.5 text-center">
          {/* Stylized vector map grid background */}
          <svg
            className="absolute inset-0 h-full w-full opacity-20"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0 20 H100 M0 50 H100 M0 80 H100 M20 0 V100 M50 0 V100 M80 0 V100"
              stroke="#C4832A"
              strokeWidth="0.75"
              fill="none"
            />
            <circle cx="50" cy="50" r="30" stroke="#C4832A" strokeWidth="0.5" fill="none" />
          </svg>

          {/* Copper pin marker */}
          <div className="relative z-10 flex flex-col items-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#C4832A]/70 bg-[#241708] text-[#E0A14A] shadow-[0_0_10px_rgba(196,131,42,0.4)]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <span className="mt-1 font-mono text-[8px] font-bold tracking-tight text-[var(--cream-muted)]">
              {latitude.toFixed(2)}, {longitude.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
