/**
 * QC P0 (10 Oct): a read may only POST a fix the device produced in this
 * session, under the live publisher's gates. Never the cached point the
 * location store is seeded with from localStorage (menrush_last_location).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const device = vi.hoisted(() => ({
  result: { ok: false, error: 'denied' } as { ok: boolean; error?: string; lat?: number; lng?: number },
  flags: { requireIdVerification: false },
}));

vi.mock('../lib/deviceLocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/deviceLocation')>();
  return {
    ...actual,
    requestDeviceLocation: vi.fn(async () => device.result),
    isGeolocationPermissionGranted: vi.fn(async () => device.result.ok),
  };
});
vi.mock('../lib/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/featureFlags')>();
  return { ...actual, FEATURES: new Proxy(actual.FEATURES, { get: (t, k) => (k === 'requireIdVerification' ? device.flags.requireIdVerification : (t as Record<string | symbol, unknown>)[k]) }) };
});

import {
  apiClient,
  usersAPI,
  hotSpotsAPI,
  eventsAPI,
  communityAPI,
  mapFeedAPI,
  recordSessionFix,
  resetLocationSyncForTests,
  SESSION_FIX_MAX_AGE_MS,
} from './client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { useLiveLocationPublisher } from '../hooks/useLiveLocationPublisher';
import { requestDeviceLocation } from '../lib/deviceLocation';

type Sent = { method: string; url: string; data: unknown };
let sent: Sent[] = [];
const originalAdapter = apiClient.defaults.adapter;
const STALE = { lat: 51.1, lng: -0.9 }; // cached point from an old session
const FRESH = { lat: 53.48, lng: -2.24 };

function posts() {
  return sent.filter((r) => r.method === 'POST' && /\/users\/location$/.test(r.url));
}

async function readEverything() {
  const { lat, lng } = useLocationStore.getState();
  await usersAPI.getNearby(lat as number, lng as number, 8);
  await usersAPI.getProfile('member-1', { lat, lng });
  await eventsAPI.getNearby(lat as number, lng as number, 50, 24);
  await hotSpotsAPI.listNearby(lat as number, lng as number, 80);
  await hotSpotsAPI.searchCruising(lat as number, lng as number, 'park');
  await mapFeedAPI.list(lat as number, lng as number, 50);
  await communityAPI.listPosts(lat as number, lng as number, 10);
}

beforeEach(() => {
  sent = [];
  resetLocationSyncForTests();
  vi.mocked(requestDeviceLocation).mockClear();
  device.result = { ok: false, error: 'denied' };
  device.flags.requireIdVerification = false;
  // Cold start: the store is seeded from localStorage, no age check.
  localStorage.setItem('menrush_last_location', JSON.stringify({ ...STALE, at: Date.now() - 3 * 86_400_000 }));
  useLocationStore.setState({ lat: STALE.lat, lng: STALE.lng });
  useAuthStore.setState({ token: 'tok', user: { id: 'u1', is_verified: true } } as never);
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const url = apiClient.getUri(config);
    sent.push({ method: (config.method ?? 'get').toUpperCase(), url, data: config.data });
    let data: unknown = {};
    if (config.method === 'get' && url.includes('/hot-spots')) data = { spots: [], location_required: true };
    if (config.method === 'get' && /events\/nearby/.test(url)) data = [];
    if (config.method === 'post') data = { success: true };
    return { data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
  };
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  localStorage.removeItem('menrush_last_location');
});

describe('reads only sync a fresh device fix from this session', () => {
  it('store seeded from localStorage + permission denied: no POST, even on location_required', async () => {
    const hook = renderHook(() => useLiveLocationPublisher());
    await waitFor(() => expect(requestDeviceLocation).toHaveBeenCalled());
    await readEverything();
    expect(posts()).toHaveLength(0);
    expect(JSON.stringify(sent)).not.toContain(String(STALE.lat));
    // location_required: one GET per hot spot read, no retry without a stored fix.
    expect(sent.filter((r) => r.url.includes('/hot-spots'))).toHaveLength(2);
    hook.unmount();
  });

  it('location off for this member (ID verification required, not verified): no POST', async () => {
    device.flags.requireIdVerification = true;
    useAuthStore.setState({ token: 'tok', user: { id: 'u1', is_verified: false } } as never);
    device.result = { ok: true, lat: FRESH.lat, lng: FRESH.lng };
    const hook = renderHook(() => useLiveLocationPublisher());
    await new Promise((r) => setTimeout(r, 20));
    expect(requestDeviceLocation).not.toHaveBeenCalled();
    await readEverything();
    expect(posts()).toHaveLength(0);
    hook.unmount();
  });

  it('signed out: no POST', async () => {
    useAuthStore.setState({ token: null, user: null } as never);
    const hook = renderHook(() => useLiveLocationPublisher());
    await readEverything();
    expect(posts()).toHaveLength(0);
    hook.unmount();
  });

  it('a stale session fix (older than the max age) is not sent', async () => {
    recordSessionFix(FRESH.lat, FRESH.lng, Date.now() - SESSION_FIX_MAX_AGE_MS - 1000);
    await readEverything();
    expect(posts()).toHaveLength(0);
  });

  it('a fresh device fix from this session POSTs once, with the device point (not the cached one)', async () => {
    device.result = { ok: true, lat: FRESH.lat, lng: FRESH.lng };
    vi.spyOn(usersAPI, 'updateLocation').mockResolvedValue({ data: { success: true } } as never);
    const hook = renderHook(() => useLiveLocationPublisher());
    await waitFor(() => expect(usersAPI.updateLocation).toHaveBeenCalledWith(FRESH.lat, FRESH.lng));
    sent = [];
    // The publisher's own save went through the spy, so the read sync sends it once.
    await usersAPI.getNearby(FRESH.lat, FRESH.lng, 8);
    await eventsAPI.getNearby(FRESH.lat, FRESH.lng, 50, 24);
    await communityAPI.listPosts(FRESH.lat, FRESH.lng, 10);
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(String(posts()[0].data))).toEqual(FRESH);
    hook.unmount();
    vi.mocked(usersAPI.updateLocation).mockRestore();
  });

  it('a revoked permission clears the session fix: no POST afterwards', async () => {
    recordSessionFix(FRESH.lat, FRESH.lng);
    const hook = renderHook(() => useLiveLocationPublisher()); // acquire() -> denied -> cleared
    await waitFor(() => expect(requestDeviceLocation).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    await readEverything();
    expect(posts()).toHaveLength(0);
    hook.unmount();
  });
});
