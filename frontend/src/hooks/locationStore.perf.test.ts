import { describe, expect, it, beforeEach } from 'vitest';
import { useLocationStore } from '../hooks/store';

describe('useLocationStore GPS jitter gate', () => {
  beforeEach(() => {
    useLocationStore.setState({ lat: null, lng: null });
  });

  it('accepts the first fix', () => {
    useLocationStore.getState().setLocation(51.5, -0.12);
    const s = useLocationStore.getState();
    expect(s.lat).toBe(51.5);
    expect(s.lng).toBe(-0.12);
  });

  it('ignores sub-15m jitter that was redrawing Discover/Chat', () => {
    useLocationStore.getState().setLocation(51.5, -0.12);
    // ~1m east at this latitude
    useLocationStore.getState().setLocation(51.5, -0.119985);
    const s = useLocationStore.getState();
    expect(s.lat).toBe(51.5);
    expect(s.lng).toBe(-0.12);
  });

  it('updates when the user actually moves', () => {
    useLocationStore.getState().setLocation(51.5, -0.12);
    // ~100m north
    useLocationStore.getState().setLocation(51.5009, -0.12);
    const s = useLocationStore.getState();
    expect(s.lat).toBe(51.5009);
    expect(s.lng).toBe(-0.12);
  });
});
