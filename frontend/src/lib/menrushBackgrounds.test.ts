import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_BACKGROUND_SESSION_KEY,
  MENRUSH_BACKGROUND_IMAGES,
  pickSessionAuthBackground,
  resetAuthBackgroundPickForTests,
} from './menrushBackgrounds';

describe('pickSessionAuthBackground', () => {
  afterEach(() => {
    resetAuthBackgroundPickForTests();
    sessionStorage.removeItem(AUTH_BACKGROUND_SESSION_KEY);
    vi.restoreAllMocks();
  });

  it('returns a photo from the Grok pool', () => {
    const picked = pickSessionAuthBackground();
    expect(MENRUSH_BACKGROUND_IMAGES).toContain(picked);
    expect(picked).toMatch(/^\/images\/menrush\/\d{2}-.+\.jpeg$/);
  });

  it('keeps the same photo across login/signup in one load', () => {
    const first = pickSessionAuthBackground();
    const second = pickSessionAuthBackground();
    expect(second).toBe(first);
    expect(sessionStorage.getItem(AUTH_BACKGROUND_SESSION_KEY)).toBe(first);
  });

  it('picks a new photo on hard refresh', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0);
    const first = pickSessionAuthBackground();
    expect(first).toBe(MENRUSH_BACKGROUND_IMAGES[0]);

    resetAuthBackgroundPickForTests();
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { type: 'reload' } as PerformanceNavigationTiming,
    ]);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999);
    const next = pickSessionAuthBackground();
    expect(next).toBe(MENRUSH_BACKGROUND_IMAGES[MENRUSH_BACKGROUND_IMAGES.length - 1]);
    expect(next).not.toBe(first);
  });
});
