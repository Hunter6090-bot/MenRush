import { INTENT_FILTERS, type IntentFilter } from '../lib/discoveryFormat';
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
  return (
    <div className="flex flex-wrap items-center gap-3">
      <RadiusMilesSelect valueKm={radiusKm} onChange={onRadiusChange} id="discover-radius-miles" />
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
