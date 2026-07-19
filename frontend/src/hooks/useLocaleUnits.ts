import { useMemo } from 'react';
import { useLocationStore } from './store';
import {
  type DistanceUnitSystem,
  formatDistanceFromKm,
  formatRadiusFromKm,
  resolveDistanceUnitSystem,
  resolveLocaleTag,
} from '../lib/localeUnits';

export function useLocaleUnits() {
  const lat = useLocationStore((s) => s.lat);
  const lng = useLocationStore((s) => s.lng);

  const unitSystem = useMemo(
    () => resolveDistanceUnitSystem({ lat, lng }),
    [lat, lng],
  );
  const localeTag = useMemo(
    () => resolveLocaleTag({ lat, lng }),
    [lat, lng],
  );

  return {
    unitSystem,
    localeTag,
    formatDistance: (km: number) => formatDistanceFromKm(km, unitSystem),
    formatRadius: (km: number) => formatRadiusFromKm(km, unitSystem),
  };
}

export type { DistanceUnitSystem };