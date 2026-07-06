import {
  DESKTOP_RADIUS_MILES,
  INTENT_FILTERS,
  type DesktopRadiusMiles,
  type IntentFilter,
} from '../lib/discoveryFormat';

interface DiscoveryFilterPillsProps {
  radiusKm: number;
  onRadiusChange: (km: DesktopRadiusMiles) => void;
  intent: IntentFilter;
  onIntentChange: (intent: IntentFilter) => void;
}

function pillClass(active: boolean) {
  return active ? 'mr-pill mr-pill-active' : 'mr-pill mr-pill-inactive hover:border-[var(--copper)]/40 hover:text-[var(--cream)]';
}

export function DiscoveryFilterPills({
  radiusKm,
  onRadiusChange,
  intent,
  onIntentChange,
}: DiscoveryFilterPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {DESKTOP_RADIUS_MILES.map((mi) => (
          <button
            key={mi}
            type="button"
            onClick={() => onRadiusChange(mi)}
            className={pillClass(radiusKm === mi)}
          >
            {mi} mile{mi === 1 ? '' : 's'}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {INTENT_FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onIntentChange(item)}
            className={pillClass(intent === item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
