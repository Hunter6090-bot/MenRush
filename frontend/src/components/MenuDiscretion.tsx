/**
 * Discretion in the top-right Menu (Pete, 8 Oct 2026). Moved off the map.
 * Reads the saved value first and only writes when the member moves the slider,
 * so opening the Menu never changes anyone's saved Discretion.
 */
import { useEffect, useRef, useState } from 'react';
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

  // Saves are serialised: one request in flight at a time, and only the newest value is sent next.
  // Quick keyboard steps (80, 120, 160) can no longer land out of order and leave an older value saved.
  const pendingRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const flushSaves = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      while (pendingRef.current !== null) {
        const meters = pendingRef.current;
        pendingRef.current = null;
        try {
          await profileMetaAPI.setMapPinFuzz(meters);
        } catch {
          /* keep optimistic UI; next read corrects */
        }
      }
    } finally {
      savingRef.current = false;
    }
  };

  const handleChange = (next: number) => {
    if (!loaded) return;
    const snapped = nearestMapPinFuzzStep(next);
    setValueM(snapped);
    window.dispatchEvent(new CustomEvent<number>(MAP_PIN_FUZZ_EVENT, { detail: snapped }));
    pendingRef.current = snapped;
    void flushSaves();
  };

  return (
    <div data-testid="menu-discretion" aria-busy={!loaded}>
      <MapDiscretionSlider valueM={valueM} onChange={handleChange} wide disabled={!loaded} />
    </div>
  );
}
