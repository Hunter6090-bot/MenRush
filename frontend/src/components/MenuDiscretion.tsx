/**
 * Discretion in the top-right Menu (Pete, 8 Oct 2026). Moved off the map.
 * Reads the saved value first and only writes when the member moves the slider,
 * so opening the Menu never changes anyone's saved Discretion.
 */
import { useEffect, useState } from 'react';
import { profileMetaAPI } from '../api/client';
import { MAP_PIN_FUZZ_DEFAULT_M, nearestMapPinFuzzStep } from '../lib/mapPinFuzz';
import { MapDiscretionSlider } from './MapDiscretionSlider';

/** Discover listens for this so the map follows a change made in the Menu. */
export const MAP_PIN_FUZZ_EVENT = 'menrush:map-pin-fuzz';

export function MenuDiscretion() {
  const [valueM, setValueM] = useState<number>(MAP_PIN_FUZZ_DEFAULT_M);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => profileMetaAPI.getMapPinFuzz())
      .then((res) => {
        if (cancelled) return;
        setValueM(nearestMapPinFuzzStep(res.data.map_pin_fuzz_m));
        setLoaded(true);
      })
      .catch(() => {
        /* stay disabled: never write a default over a value we could not read */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (next: number) => {
    if (!loaded) return;
    const snapped = nearestMapPinFuzzStep(next);
    setValueM(snapped);
    window.dispatchEvent(new CustomEvent<number>(MAP_PIN_FUZZ_EVENT, { detail: snapped }));
    void profileMetaAPI.setMapPinFuzz(snapped).catch(() => {
      /* keep optimistic UI; next read corrects */
    });
  };

  return (
    <div data-testid="menu-discretion" aria-busy={!loaded}>
      <MapDiscretionSlider valueM={valueM} onChange={handleChange} wide disabled={!loaded} />
    </div>
  );
}
