import { describe, expect, it } from 'vitest';
import { shouldBlurMedia } from '../components/SoftBlurMedia';

describe('shouldBlurMedia', () => {
  it('blurs only when media_clear is explicitly false', () => {
    expect(shouldBlurMedia(false)).toBe(true);
    expect(shouldBlurMedia(true)).toBe(false);
    expect(shouldBlurMedia(undefined)).toBe(false);
    expect(shouldBlurMedia(null)).toBe(false);
  });
});
