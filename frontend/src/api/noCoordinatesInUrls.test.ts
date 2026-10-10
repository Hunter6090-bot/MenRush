import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  apiClient,
  usersAPI,
  eventsAPI,
  hotSpotsAPI,
  mapFeedAPI,
  communityAPI,
  onLocationSaved,
  roomsAPI,
  resetLocationSyncForTests,
  stripCoordinatesFromRequest,
} from './client';

type Sent = { method: string; url: string; data: unknown };

const LAT = 53.480812;
const LNG = -2.242631;

let sent: Sent[] = [];
const originalAdapter = apiClient.defaults.adapter;

beforeEach(() => {
  sent = [];
  resetLocationSyncForTests();
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    sent.push({
      method: (config.method ?? 'get').toUpperCase(),
      url: apiClient.getUri(config),
      data: config.data,
    });
    const isList = /\/(events\/nearby|rooms)(\?|$)/.test(apiClient.getUri(config));
    return {
      data: isList ? [] : {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  };
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

const COORD_IN_URL = /[?&](lat|lng|lon|latitude|longitude)=/i;

function gets(): Sent[] {
  return sent.filter((r) => r.method === 'GET');
}

describe('no coordinates in /api GET URLs', () => {
  it('every location-based read sends no lat= or lng= in its URL', async () => {
    await usersAPI.getNearby(LAT, LNG, 8, { page: 1, limit: 60 });
    await usersAPI.getProfile('member-1', { lat: LAT, lng: LNG });
    await eventsAPI.getNearby(LAT, LNG, 50, 24);
    await hotSpotsAPI.listNearby(LAT, LNG, 80, 'saunas', { sort: 'live' });
    await hotSpotsAPI.searchCruising(LAT, LNG, 'park');
    await mapFeedAPI.list(LAT, LNG, 50);
    await communityAPI.listPosts(LAT, LNG, 10);
    await roomsAPI.getRooms();

    const urls = gets().map((r) => r.url);
    expect(urls.length).toBe(8);
    for (const url of urls) {
      expect(url, url).not.toMatch(COORD_IN_URL);
      expect(url, url).not.toContain(String(LAT));
      expect(url, url).not.toContain(String(LNG));
    }
    expect(urls.some((u) => u.includes('/users/nearby'))).toBe(true);
    expect(urls.some((u) => u.includes('/hot-spots'))).toBe(true);
  });

  it('the fix goes once in the body of POST /users/location', async () => {
    await usersAPI.getNearby(LAT, LNG, 8);
    await eventsAPI.getNearby(LAT, LNG, 50, 24);
    await hotSpotsAPI.listNearby(LAT, LNG, 80);

    const posts = sent.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toMatch(/\/users\/location$/);
    expect(JSON.parse(String(posts[0].data))).toEqual({ lat: LAT, lng: LNG });
    // The POST comes before the read that needs it.
    expect(sent[0].method).toBe('POST');
  });

  it('a moved fix is sent again before the next read', async () => {
    await usersAPI.getNearby(LAT, LNG, 8);
    await usersAPI.getNearby(LAT + 0.01, LNG, 8);
    const posts = sent.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(2);
  });

  it('a read still goes out when the location sync fails', async () => {
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      sent.push({ method: (config.method ?? 'get').toUpperCase(), url: apiClient.getUri(config), data: config.data });
      if (config.method === 'post') throw new Error('offline');
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    };
    await expect(usersAPI.getNearby(LAT, LNG, 8)).resolves.toBeTruthy();
    expect(gets()).toHaveLength(1);
  });

  it('hot spots: location_required re-sends the fix (no one-minute skip) and retries once', async () => {
    let hotSpotGets = 0;
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const url = apiClient.getUri(config);
      sent.push({ method: (config.method ?? 'get').toUpperCase(), url, data: config.data });
      let data: unknown = { success: true };
      if (config.method === 'get' && url.includes('/hot-spots')) {
        hotSpotGets += 1;
        data = hotSpotGets === 1 ? { spots: [], location_required: true } : { spots: [{ id: 's1' }] };
      }
      return { data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    };
    const res = await hotSpotsAPI.listNearby(LAT, LNG, 80);
    expect(res.data.spots).toEqual([{ id: 's1' }]);
    expect(sent.map((r) => r.method)).toEqual(['POST', 'GET', 'POST', 'GET']);
  });

  it('hot spots: retries only once when the location is still missing', async () => {
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      sent.push({ method: (config.method ?? 'get').toUpperCase(), url: apiClient.getUri(config), data: config.data });
      const data = config.method === 'get' ? { spots: [], location_required: true } : { success: true };
      return { data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    };
    const res = await hotSpotsAPI.searchCruising(LAT, LNG, 'park');
    expect(res.data.location_required).toBe(true);
    expect(gets()).toHaveLength(2);
  });

  it('onLocationSaved fires for a stored fix, not for one the server refused', async () => {
    const saved = vi.fn();
    onLocationSaved(saved);
    await usersAPI.updateLocation(LAT, LNG);
    expect(saved).toHaveBeenCalledTimes(1);
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      sent.push({ method: (config.method ?? 'get').toUpperCase(), url: apiClient.getUri(config), data: config.data });
      const data = config.method === 'post' ? { success: false, code: 'location_not_accepted' } : {};
      return { data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    };
    await usersAPI.updateLocation(LAT, LNG);
    await usersAPI.getNearby(LAT, LNG, 8);
    expect(saved).toHaveBeenCalledTimes(1);
    // A refused fix is not remembered as synced: the next read sends it again.
    await usersAPI.getNearby(LAT, LNG, 8);
    expect(sent.filter((r) => r.method === 'POST')).toHaveLength(4);
  });

  it('the safety net strips coordinates from any request params and URL', async () => {
    await apiClient.get('/anything?lat=1.5&lng=2.5&q=x', { params: { latitude: 1, longitude: 2, radius: 5 } });
    const url = gets()[0].url;
    expect(url).not.toMatch(COORD_IN_URL);
    expect(url).toContain('q=x');
    expect(url).toContain('radius=5');

    const cfg = stripCoordinatesFromRequest({ url: '/x?LAT=1&LON=2', params: { Lng: 3, limit: 1 } });
    expect(cfg.url).toBe('/x');
    expect(cfg.params).toEqual({ limit: 1 });
  });

  it('safety net also drops lat[], filter[lat], ll and coords (same rule as the server)', () => {
    const cfg = stripCoordinatesFromRequest({
      url: '/x?lat[]=1&filter%5Blat%5D=2&ll=1,2&coords=3&q=a',
      params: { 'lat[]': 1, ll: 2, coords: 3, limit: 1, latest: 1 },
    });
    expect(cfg.url).toBe('/x?q=a');
    expect(cfg.params).toEqual({ limit: 1, latest: 1 });
  });
});
