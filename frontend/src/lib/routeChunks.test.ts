import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prefetchAppRouteChunks, resetPrefetchLatchForTests } from './routeChunks';

describe('routeChunks prefetch', () => {
  beforeEach(() => {
    resetPrefetchLatchForTests();
  });

  it('schedules only once per session', () => {
    let idleCalls = 0;
    const original = (
      window as Window & { requestIdleCallback?: typeof window.requestIdleCallback }
    ).requestIdleCallback;
    (
      window as Window & { requestIdleCallback?: (cb: () => void) => number }
    ).requestIdleCallback = (cb) => {
      idleCalls += 1;
      cb();
      return 1;
    };

    prefetchAppRouteChunks();
    prefetchAppRouteChunks();
    expect(idleCalls).toBe(1);

    if (original) {
      (
        window as Window & { requestIdleCallback?: typeof window.requestIdleCallback }
      ).requestIdleCallback = original;
    } else {
      delete (window as Window & { requestIdleCallback?: unknown }).requestIdleCallback;
    }
  });
});

describe('service worker fetch policy', () => {
  it('does not call respondWith (no network proxy on phones)', () => {
    const sw = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');
    expect(sw).toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(sw).not.toMatch(/respondWith\s*\(/);
    expect(sw).toMatch(/do not intercept/i);
  });
});
