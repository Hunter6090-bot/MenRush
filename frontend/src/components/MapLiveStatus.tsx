import { MAX_RADIUS_KM } from '../lib/discoveryFormat';

interface MapLiveStatusProps {
  nearbyCount: number;
  liveCount: number;
  radiusKm: number;
  onExpandRadius: () => void;
  className?: string;
}

/**
 * Map status pill: nearby = radius roster; Live = online-now presence only.
 * Never paints filter/radius labels (e.g. "All") as Live.
 */
export function MapLiveStatus({
  nearbyCount,
  liveCount,
  radiusKm,
  onExpandRadius,
  className = '',
}: MapLiveStatusProps) {
  return (
    <div
      className={className}
      data-testid="map-live-status"
      data-live-count={liveCount}
      data-nearby-count={nearbyCount}
    >
      <span
        className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
          liveCount > 0 ? 'bg-[#3D7A2E]' : 'bg-[#8A7A62]'
        }`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-tight text-[#1A1208]">
          {nearbyCount} nearby
        </p>
        {liveCount > 0 ? (
          <p className="text-[11px] font-semibold text-[#3D7A2E]" data-testid="map-live-line">
            Live · {liveCount}
          </p>
        ) : (
          <p className="text-[11px] font-semibold text-[#6B5B45]" data-testid="map-live-line">
            None live now
            {nearbyCount === 0 && radiusKm < MAX_RADIUS_KM - 0.5 ? (
              <button
                type="button"
                className="pointer-events-auto ml-1.5 font-extrabold text-[#B8732A] underline-offset-2 hover:underline"
                onClick={onExpandRadius}
              >
                Expand radius
              </button>
            ) : null}
          </p>
        )}
      </div>
    </div>
  );
}
