import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MENRUSH_BACKGROUND_IMAGES,
  pickPageBackground,
  resetPageBackgroundPickForTests,
} from './menrushBackgrounds';

describe('pickPageBackground', () => {
  afterEach(() => {
    resetPageBackgroundPickForTests();
    vi.restoreAllMocks();
  });

  it('returns a photo from the MenRush pool', () => {
    const picked = pickPageBackground();
    expect(MENRUSH_BACKGROUND_IMAGES).toContain(picked);
    expect(picked).toMatch(/^\/images\/menrush\/\d{2}-.+\.jpeg$/);
  });

  it('avoids immediately repeating the previous page image when pool > 1', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0);
    const first = pickPageBackground();
    expect(first).toBe(MENRUSH_BACKGROUND_IMAGES[0]);

    // Next pick should exclude index 0; mockRandom 0 → first of remaining (= old [1])
    vi.spyOn(Math, 'random').mockReturnValueOnce(0);
    const second = pickPageBackground();
    expect(second).toBe(MENRUSH_BACKGROUND_IMAGES[1]);
    expect(second).not.toBe(first);
  });

  it('can return the earlier image again after an intervening pick', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // → [0]
      .mockReturnValueOnce(0) // → [1] (excluding [0])
      .mockReturnValueOnce(0); // → [0] again (excluding [1])
    const a = pickPageBackground();
    const b = pickPageBackground();
    const c = pickPageBackground();
    expect(a).toBe(MENRUSH_BACKGROUND_IMAGES[0]);
    expect(b).toBe(MENRUSH_BACKGROUND_IMAGES[1]);
    expect(c).toBe(MENRUSH_BACKGROUND_IMAGES[0]);
  });
});
