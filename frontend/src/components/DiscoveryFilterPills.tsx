import {
  DEFAULT_RADIUS_KM,
  INTENT_FILTERS,
  QUICK_RADIUS_MILES,
  isQuickRadiusActive,
  radiusSelectionToKm,
  type IntentFilter,
  type QuickRadiusMiles,
} from '../lib/discoveryFormat';
import { RadiusMilesSelect } from './RadiusMilesSelect';

interface DiscoveryFilterPillsProps {
  radiusKm: number;
  onRadiusChange: (km: number) => void;
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
  const handleQuickRadius = (miles: QuickRadiusMiles) => {
    if (isQuickRadiusActive(radiusKm, miles)) {
      onRadiusChange(DEFAULT_RADIUS_KM);
      return;
    }
    onRadiusChange(radiusSelectionToKm(miles));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <RadiusMilesSelect valueKm={radiusKm} onChange={onRadiusChange} id="discover-radius-miles" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick radius presets">
          {QUICK_RADIUS_MILES.map((mi) => (
            <button
              key={mi}
              type="button"
              aria-pressed={isQuickRadiusActive(radiusKm, mi)}
              onClick={() => handleQuickRadius(mi)}
              className={pillClass(isQuickRadiusActive(radiusKm, mi))}
            >
              {mi} mi
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {INTENT_FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={intent === item}
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
