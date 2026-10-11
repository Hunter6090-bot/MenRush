/**
 * QC P1s on #419's Out recovery reload:
 * - A failed background recovery reload is retried with backoff (1s, then 3s), keeping
 *   the list visible, and then stops: never a loop.
 * - The quiet (background) flag is cleared after each load, so a later normal load
 *   (location change, chip change) shows the spinner again.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out, OUT_RECOVERY_RETRY_DELAYS_MS } from './Out';
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

const C: HotSpotDTO = { ...B, id: 'spot-c', name: 'Charlie Dunes', live_count: 7 } as HotSpotDTO;
const fail = () => {
  const p = Promise.reject(new Error('Request failed with status code 500'));
  p.catch(() => {});
  return p as never;
};
const spinner = () => screen.queryByLabelText('Loading Out');
const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

/** First load (A), move (load dropped by the check-in), re-read fails: recovery reload starts. */
async function startRecovery(lateLoad: Promise<unknown>) {
  vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
    data: { ok: true, spot: { ...A, is_checked_in: true, live_count: 3 } },
  } as never);
  render(<MemoryRouter><Out /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId(`out-spot-open-${A.id}`));
  await screen.findByTestId('hotspot-sheet');
  act(() => useLocationStore.setState({ lat: 53.4, lng: -2.2 }));
  await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
  await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(4));
  void lateLoad;
}

describe('Out recovery reload: retry with backoff, then stop; quiet flag resets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocationStore.setState({ lat: 51.0, lng: -0.8 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('backoff is short and bounded (two retries)', () => {
    expect(OUT_RECOVERY_RETRY_DELAYS_MS).toEqual([1000, 3000]);
  });

  it('a failed recovery reload is retried after the backoff, keeping the list, and the retry lands', async () => {
    const lateLoad = deferred<unknown>();
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(A))
      .mockReturnValueOnce(lateLoad.promise as never)
      .mockReturnValueOnce(fail()) // re-read
      .mockReturnValueOnce(fail()) // recovery reload
      .mockResolvedValueOnce(list(C)); // first retry
    await startRecovery(lateLoad.promise);

    // Not retried before the backoff; the list and the sheet stay, no spinner, no error.
    await advance(900);
    expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(4);
    expect(spinner()).toBeNull();
    expect(screen.queryByText('Could not load Out.')).toBeNull();
    expect(screen.getByTestId(`out-spot-open-${A.id}`)).toBeInTheDocument();
    expect(screen.getByTestId('hotspot-sheet')).toBeInTheDocument();

    await advance(200);
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(5));
    expect(await screen.findByTestId(`out-spot-open-${C.id}`)).toBeInTheDocument();
    expect(spinner()).toBeNull();
    lateLoad.resolve(list(C));
  });

  it('gives up after two retries (1s, then 3s): never loops, list stays, no error', async () => {
    const lateLoad = deferred<unknown>();
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(A))
      .mockReturnValueOnce(lateLoad.promise as never)
      .mockImplementation(() => fail()); // re-read, recovery, and every retry fail
    await startRecovery(lateLoad.promise);

    await advance(1000);
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(5));
    await advance(2900);
    expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(5);
    await advance(200);
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(6));

    // Much later: still 6 calls (first load, moved load, re-read, recovery + 2 retries).
    await advance(60_000);
    expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(6);
    expect(spinner()).toBeNull();
    expect(screen.queryByText('Could not load Out.')).toBeNull();
    expect(screen.getByTestId(`out-spot-open-${A.id}`)).toBeInTheDocument();
    lateLoad.resolve(list(A));
  });

  it('after a background recovery, the next normal load shows the spinner again', async () => {
    const lateLoad = deferred<unknown>();
    const nextLoad = deferred<unknown>();
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(A))
      .mockReturnValueOnce(lateLoad.promise as never)
      .mockReturnValueOnce(fail()) // re-read
      .mockResolvedValueOnce(list(C)) // recovery reload lands
      .mockReturnValueOnce(nextLoad.promise as never); // a later location change
    await startRecovery(lateLoad.promise);
    expect(await screen.findByTestId(`out-spot-open-${C.id}`)).toBeInTheDocument();
    expect(spinner()).toBeNull();

    act(() => useLocationStore.setState({ lat: 55.9, lng: -3.2 }));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(5));
    expect(spinner()).not.toBeNull();
    await act(async () => {
      nextLoad.resolve(list(B));
      await nextLoad.promise;
    });
    expect(await screen.findByTestId(`out-spot-open-${B.id}`)).toBeInTheDocument();
    expect(spinner()).toBeNull();
    lateLoad.resolve(list(C));
  });

  it('a location change in the same render as the recovery reload is a normal load (spinner shows)', async () => {
    const lateLoad = deferred<unknown>();
    let rejectReread!: (e: Error) => void;
    const reread = new Promise((_, rej) => { rejectReread = rej; });
    reread.catch(() => {});
    const nextLoad = deferred<unknown>();
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(A))
      .mockReturnValueOnce(lateLoad.promise as never)
      .mockReturnValueOnce(reread as never)
      .mockReturnValueOnce(nextLoad.promise as never);
    vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
      data: { ok: true, spot: { ...A, is_checked_in: true, live_count: 3 } },
    } as never);
    render(<MemoryRouter><Out /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId(`out-spot-open-${A.id}`));
    await screen.findByTestId('hotspot-sheet');
    act(() => useLocationStore.setState({ lat: 53.4, lng: -2.2 }));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(3));

    // The re-read fails (raising the quiet recovery reload) and the member moves again,
    // both before React renders: one load runs, and it is for the new location.
    await act(async () => {
      rejectReread(new Error('Request failed with status code 500'));
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
      useLocationStore.setState({ lat: 55.9, lng: -3.2 });
    });
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(4));
    expect(vi.mocked(hotSpotsAPI.listNearby).mock.calls[3].slice(0, 2)).toEqual([55.9, -3.2]);
    expect(spinner()).not.toBeNull();
    await act(async () => {
      nextLoad.resolve(list(B));
      await nextLoad.promise;
    });
    expect(await screen.findByTestId(`out-spot-open-${B.id}`)).toBeInTheDocument();
    lateLoad.resolve(list(C));
  });

  it('a normal load that fails still shows the error (only the recovery reload is quiet)', async () => {
    vi.mocked(hotSpotsAPI.listNearby).mockResolvedValueOnce(list(A)).mockImplementation(() => fail());
    render(<MemoryRouter><Out /></MemoryRouter>);
    await screen.findByTestId(`out-spot-open-${A.id}`);
    act(() => useLocationStore.setState({ lat: 53.4, lng: -2.2 }));
    expect(await screen.findByText('Could not load Out.')).toBeInTheDocument();
    expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2); // no retry for a normal load
  });
});
