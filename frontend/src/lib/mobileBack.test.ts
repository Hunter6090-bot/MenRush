import { describe, expect, it } from 'vitest';
import { MOBILE_TAB_ROOTS, mobileBackFallback, shouldShowMobileBack } from './mobileBack';

describe('mobileBack — redesign Step 1 five-tab roots', () => {
  it('treats Map · Chat · Rooms · Out · You as tab roots (no back control)', () => {
    expect([...MOBILE_TAB_ROOTS].sort()).toEqual(
      ['/conversations', '/discover', '/out', '/profile', '/rooms'].sort(),
    );
    expect(shouldShowMobileBack('/rooms')).toBe(false);
    expect(shouldShowMobileBack('/rooms/abc')).toBe(true);
    expect(shouldShowMobileBack('/conversations')).toBe(false);
    expect(shouldShowMobileBack('/out')).toBe(false);
    expect(shouldShowMobileBack('/stream')).toBe(true);
    expect(shouldShowMobileBack('/matches')).toBe(true);
  });

  it('sends Events / Cruise / Community back to Out', () => {
    expect(mobileBackFallback('/events')).toBe('/out');
    expect(mobileBackFallback('/hot-spots')).toBe('/out');
    expect(mobileBackFallback('/stream')).toBe('/out');
    expect(mobileBackFallback('/matches')).toBe('/conversations');
  });
});
