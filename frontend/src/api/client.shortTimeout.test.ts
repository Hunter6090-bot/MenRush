/**
 * QC P1 on #354: a hung /push/vapid-public (or /prompt-prefs) must not hold the
 * top prompts for ever. Those calls get a 4s timeout; uploads and every other
 * call keep their own timeout or none.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import {
  apiClient,
  messagesAPI,
  promptPrefsAPI,
  SHORT_REQUEST_TIMEOUT_MS,
  shortTimeoutFor,
  usersAPI,
} from './client';
import { isPushConfigured } from '../lib/push';

const originalAdapter = apiClient.defaults.adapter;
let seen: InternalAxiosRequestConfig[];

/** Records each request and answers 200, like a healthy server. */
const okAdapter: AxiosAdapter = async (config) => {
  seen.push(config);
  return { data: { publicKey: 'BKey', configured: true, never: [] }, status: 200, statusText: 'OK', headers: {}, config };
};

/** Never answers; rejects only when the request's own timeout fires, as axios does. */
const hungAdapter: AxiosAdapter = (config) =>
  new Promise((_, reject) => {
    seen.push(config);
    if (config.timeout) {
      setTimeout(
        () => reject(Object.assign(new Error(`timeout of ${config.timeout}ms exceeded`), { code: 'ECONNABORTED', config })),
        config.timeout,
      );
    }
  });

beforeEach(() => {
  seen = [];
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.useRealTimers();
});

describe('short timeout for the prompt gating calls', () => {
  it('is between 3s and 5s', () => {
    expect(SHORT_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(3000);
    expect(SHORT_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });

  it('applies to /push/vapid-public and /prompt-prefs only', () => {
    for (const url of ['/push/vapid-public', 'push/vapid-public', '/prompt-prefs', '/prompt-prefs/alerts/never']) {
      expect(shortTimeoutFor(url), url).toBe(SHORT_REQUEST_TIMEOUT_MS);
    }
    for (const url of ['/push/subscribe', '/prompt-prefsx', '/users/photo', '/messages/media', '/auth/register', undefined]) {
      expect(shortTimeoutFor(url), String(url)).toBeUndefined();
    }
  });

  it('the real calls go out with 4s; uploads keep theirs; the client has no global default', async () => {
    apiClient.defaults.adapter = okAdapter;
    await isPushConfigured();
    await promptPrefsAPI.get();
    await promptPrefsAPI.setNever('alerts');
    await usersAPI.uploadPhoto(new File(['x'], 'me.jpg', { type: 'image/jpeg' }));
    await messagesAPI.sendMedia('member-b', new File(['x'], 'v.mp4', { type: 'video/mp4' }), { kind: 'video' } as never);

    const byUrl = Object.fromEntries(seen.map((c) => [c.url, c.timeout]));
    expect(byUrl['/push/vapid-public']).toBe(SHORT_REQUEST_TIMEOUT_MS);
    expect(byUrl['/prompt-prefs']).toBe(SHORT_REQUEST_TIMEOUT_MS);
    expect(byUrl['/prompt-prefs/alerts/never']).toBe(SHORT_REQUEST_TIMEOUT_MS);
    expect(byUrl['/users/photo'] ?? 0).toBe(0);
    expect(byUrl['/messages/media']).toBe(180_000);
    expect(apiClient.defaults.timeout ?? 0).toBe(0);
  });

  it('a hung /push/vapid-public gives up after 4s, so the prompts can move on', async () => {
    vi.useFakeTimers();
    apiClient.defaults.adapter = hungAdapter;
    let result: boolean | undefined;
    void isPushConfigured().then((v) => {
      result = v;
    });
    await vi.advanceTimersByTimeAsync(SHORT_REQUEST_TIMEOUT_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(2);
    expect(result).toBe(false);
  });
});
