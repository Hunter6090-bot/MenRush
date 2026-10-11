/**
 * QC P0 / P1 on #393: list re-reads after a check-in are latest-wins.
 * - A slow re-read for spot A must never overwrite spot B's newer check-in.
 * - A re-read started at an old location must never overwrite the new location's list.
 * - A hung re-read gives up after about 5s and the server spot from the check-in stays.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out, OUT_REFRESH_TIMEOUT_MS } from './Out';
import { hotSpotsAPI, type HotSpotDTO } from '../api/client';
import { useLocationStore } from '../hooks/store';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      listNearby: vi.fn(),
      listReviews: vi.fn().mockResolvedValue({ data: { reviews: [], rating_avg: null, review_count: 0 } }),
      checkIn: vi.fn(),
      checkOut: vi.fn(),
    },
    eventsAPI: { ...actual.eventsAPI, getNearby: vi.fn().mockResolvedValue({ data: [] }) },
  };
});

const base = {
  city: 'Chichester', description: 'Open space', latitude: 51.03, longitude: -0.85,
  category_id: 5, category_slug: 'open-spaces', category_name: 'Open spaces', category_icon: '🏞️',
  distance_km: 12, live_count_exact: null, my_checkin_anonymous: null, checkin_ttl_hours: 2,
  has_active_checkins: true,
};
const A: HotSpotDTO = { ...base, id: 'spot-a', name: 'Alpha Lay-by', live_count: 2, is_checked_in: false } as HotSpotDTO;
const B: HotSpotDTO = { ...base, id: 'spot-b', name: 'Bravo Woods', live_count: 1, is_checked_in: false } as HotSpotDTO;
const list = (...s: HotSpotDTO[]) => ({ data: { spots: s } }) as never;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

async function openSpot(id: string) {
  fireEvent.click(await screen.findByTestId(`out-spot-open-${id}`));
  return screen.findByTestId('hotspot-sheet');
}
function closeSheet() {
  fireEvent.click(screen.getByTestId('hotspot-sheet-close'));
}

describe('Out list re-reads are latest-wins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocationStore.setState({ lat: 51.0, lng: -0.8 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a late re-read for spot A does not overwrite spot B\'s newer check-in', async () => {
    const lateA = deferred<unknown>();
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(A, B)) // first load
      .mockReturnValueOnce(lateA.promise as never) // re-read after A's check-in: slow
      .mockResolvedValueOnce(list({ ...A, is_checked_in: true, live_count: 3 }, { ...B, is_checked_in: true, live_count: 5 }));
    vi.mocked(hotSpotsAPI.checkIn).mockImplementation(((id: string) =>
      Promise.resolve({
        data: { ok: true, spot: id === A.id ? { ...A, is_checked_in: true, live_count: 3 } : { ...B, is_checked_in: true, live_count: 5 } },
      })) as never);

    render(<MemoryRouter><Out /></MemoryRouter>);
    await openSpot(A.id);
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
    closeSheet();

    await openSpot(B.id);
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('5 checked in'));

    // A's re-read finally lands with a list read before B's check-in.
    await act(async () => {
      lateA.resolve(list({ ...A, is_checked_in: true, live_count: 3 }, B));
      await lateA.promise;
    });
    expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('5 checked in');
    expect(screen.getByTestId('hotspot-sheet-checkout')).toBeInTheDocument();
  });

  it('a re-read started at the old location never overwrites the new location\'s list', async () => {
    const lateOld = deferred<unknown>();
    const C: HotSpotDTO = { ...B, id: 'spot-c', name: 'Charlie Dunes', live_count: 7 } as HotSpotDTO;
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(A)) // first load, old location
      .mockReturnValueOnce(lateOld.promise as never) // re-read after check-in, old location: slow
      .mockResolvedValueOnce(list(C)); // load for the new location
    vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
      data: { ok: true, spot: { ...A, is_checked_in: true, live_count: 3 } },
    } as never);

    render(<MemoryRouter><Out /></MemoryRouter>);
    await openSpot(A.id);
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
    closeSheet();

    act(() => useLocationStore.setState({ lat: 53.4, lng: -2.2 }));
    expect(await screen.findByTestId(`out-spot-open-${C.id}`)).toBeInTheDocument();

    await act(async () => {
      lateOld.resolve(list({ ...A, is_checked_in: true, live_count: 3 }));
      await lateOld.promise;
    });
    expect(screen.getByTestId(`out-spot-open-${C.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`out-spot-open-${A.id}`)).toBeNull();
  });

  it('a hung re-read times out after about 5s and keeps the server spot', async () => {
    expect(OUT_REFRESH_TIMEOUT_MS).toBeLessThanOrEqual(5000);
    const hung = deferred<unknown>();
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(A))
      .mockReturnValueOnce(hung.promise as never);
    vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
      data: { ok: true, spot: { ...A, is_checked_in: true, live_count: 3 } },
    } as never);

    render(<MemoryRouter><Out /></MemoryRouter>);
    await openSpot(A.id);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('3 checked in'));
    // Still acting while the re-read hangs.
    expect(screen.getByTestId('hotspot-sheet-checkout')).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(OUT_REFRESH_TIMEOUT_MS + 50);
    });
    await waitFor(() => expect(screen.getByTestId('hotspot-sheet-checkout')).not.toBeDisabled());
    expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('3 checked in');

    // The hung reply finally arrives with a stale list: it is dropped.
    await act(async () => {
      hung.resolve(list(A));
      await hung.promise;
    });
    expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('3 checked in');
    expect(screen.getByTestId('hotspot-sheet-checkout')).toBeInTheDocument();
  });
  it.each(['fails', 'times out'] as const)(
    'a location-change load dropped by a check-in is reloaded when the re-read %s',
    async (mode) => {
      const lateLoad = deferred<unknown>();
      const C: HotSpotDTO = { ...B, id: 'spot-c', name: 'Charlie Dunes', live_count: 7 } as HotSpotDTO;
      const reread =
        mode === 'fails'
          ? Promise.reject(Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } }))
          : new Promise(() => {});
      reread.catch(() => {});
      vi.mocked(hotSpotsAPI.listNearby)
        .mockResolvedValueOnce(list(A)) // first load, old location
        .mockReturnValueOnce(lateLoad.promise as never) // load for the new location: still in flight
        .mockReturnValueOnce(reread as never) // re-read after the check-in: 500 or hangs
        .mockResolvedValue(list(C)); // reload for the new location
      vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
        data: { ok: true, spot: { ...A, is_checked_in: true, live_count: 3 } },
      } as never);

      render(<MemoryRouter><Out /></MemoryRouter>);
      await openSpot(A.id);
      if (mode === 'times out') vi.useFakeTimers({ shouldAdvanceTime: true });
      act(() => useLocationStore.setState({ lat: 53.4, lng: -2.2 }));
      await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));

      // The check-in's server spot drops the in-flight load; then its re-read goes wrong.
      fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
      await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(3));
      if (mode === 'times out') {
        await act(async () => {
          vi.advanceTimersByTime(OUT_REFRESH_TIMEOUT_MS + 50);
        });
      }
      // The dropped load's reply finally lands (stale, ignored).
      await act(async () => {
        lateLoad.resolve(list(C));
        await lateLoad.promise;
      });

      // Out reloads for the new location instead of leaving the old list in place.
      await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(4));
      expect(vi.mocked(hotSpotsAPI.listNearby).mock.calls[3].slice(0, 2)).toEqual([53.4, -2.2]);
      expect(await screen.findByTestId(`out-spot-open-${C.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`out-spot-open-${A.id}`)).toBeNull();
    },
  );
  it('the recovery reload runs in the background: the list stays visible behind the open sheet', async () => {
    const lateLoad = deferred<unknown>();
    const reload = deferred<unknown>();
    const C: HotSpotDTO = { ...B, id: 'spot-c', name: 'Charlie Dunes', live_count: 7 } as HotSpotDTO;
    const failed = Promise.reject(new Error('Request failed with status code 500'));
    failed.catch(() => {});
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(A)) // first load
      .mockReturnValueOnce(lateLoad.promise as never) // location-change load, dropped by the check-in
      .mockReturnValueOnce(failed as never) // re-read 500s
      .mockReturnValueOnce(reload.promise as never); // recovery reload: still in flight
    vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
      data: { ok: true, spot: { ...A, is_checked_in: true, live_count: 3 } },
    } as never);

    render(<MemoryRouter><Out /></MemoryRouter>);
    await openSpot(A.id);
    act(() => useLocationStore.setState({ lat: 53.4, lng: -2.2 }));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(4));

    // While the recovery reload is in flight: no spinner, the list and the sheet stay.
    await waitFor(() => expect(screen.queryByLabelText('Loading Out')).toBeNull());
    expect(screen.getByTestId('out-list')).toBeInTheDocument();
    expect(screen.getByTestId(`out-spot-open-${A.id}`)).toBeInTheDocument();
    expect(screen.getByTestId('hotspot-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('3 checked in');

    await act(async () => {
      reload.resolve(list(C));
      await reload.promise;
    });
    expect(await screen.findByTestId(`out-spot-open-${C.id}`)).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading Out')).toBeNull();
    lateLoad.resolve(list(C));
  });

  it('a failed recovery reload keeps the list (no error screen)', async () => {
    const lateLoad = deferred<unknown>();
    const fail = () => {
      const p = Promise.reject(new Error('Request failed with status code 500'));
      p.catch(() => {});
      return p as never;
    };
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(A))
      .mockReturnValueOnce(lateLoad.promise as never)
      .mockReturnValueOnce(fail())
      .mockReturnValueOnce(fail());
    vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
      data: { ok: true, spot: { ...A, is_checked_in: true, live_count: 3 } },
    } as never);

    render(<MemoryRouter><Out /></MemoryRouter>);
    await openSpot(A.id);
    act(() => useLocationStore.setState({ lat: 53.4, lng: -2.2 }));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.queryByLabelText('Loading Out')).toBeNull());
    expect(screen.queryByText('Could not load Out.')).toBeNull();
    expect(screen.getByTestId(`out-spot-open-${A.id}`)).toBeInTheDocument();
    lateLoad.resolve(list(A));
  });
});
