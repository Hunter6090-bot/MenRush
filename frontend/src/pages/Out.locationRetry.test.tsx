import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out } from './Out';
import { hotSpotsAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const savedListeners = new Set<() => void>();

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    onLocationSaved: (cb: () => void) => {
      savedListeners.add(cb);
      return () => savedListeners.delete(cb);
    },
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      listNearby: vi.fn(),
      checkIn: vi.fn(),
      checkOut: vi.fn(),
    },
    eventsAPI: {
      ...actual.eventsAPI,
      getNearby: vi.fn().mockResolvedValue({ data: [] }),
    },
  };
});

/** QC P1 (10 Oct): a brand-new member's first Out read can land before the first location save. */
describe('Out reloads once the first location is saved', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedListeners.clear();
    useLocationStore.setState({ lat: 51.5074, lng: -0.1278 });
  });

  it('location_required on first load: reloads when the location save lands, then stops listening', async () => {
    const list = vi.mocked(hotSpotsAPI.listNearby);
    list.mockResolvedValueOnce({ data: { spots: [], location_required: true } } as never);
    list.mockResolvedValue({ data: { spots: [] } } as never);
    render(
      <MemoryRouter initialEntries={['/out']}>
        <Out />
      </MemoryRouter>,
    );
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(savedListeners.size).toBe(1));

    // Same coordinates in the store (nothing moved), the server now has them.
    act(() => {
      for (const cb of Array.from(savedListeners)) cb();
    });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(savedListeners.size).toBe(0));

    // Later saves do not reload again.
    act(() => {
      for (const cb of Array.from(savedListeners)) cb();
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('a normal first load does not wait for a save', async () => {
    const list = vi.mocked(hotSpotsAPI.listNearby);
    list.mockResolvedValue({ data: { spots: [] } } as never);
    render(
      <MemoryRouter initialEntries={['/out']}>
        <Out />
      </MemoryRouter>,
    );
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(savedListeners.size).toBe(0);
  });
});
