import { describe, expect, it } from 'vitest';
import { MOBILE_TAB_ROOTS, shouldShowMobileBack } from './mobileBack';

describe('mobileBack — Video rooms primary tab', () => {
  it('treats /rooms as a tab root (no back control)', () => {
    expect(MOBILE_TAB_ROOTS.has('/rooms')).toBe(true);
    expect(shouldShowMobileBack('/rooms')).toBe(false);
    expect(shouldShowMobileBack('/rooms/abc')).toBe(true);
    expect(shouldShowMobileBack('/conversations')).toBe(false);
  });
});
