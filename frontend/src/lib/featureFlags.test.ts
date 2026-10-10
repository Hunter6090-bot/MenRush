import { describe, it, expect } from 'vitest';
import { FEATURES } from './featureFlags';

describe('FEATURES trust gate', () => {
  it('keeps signup open — requireIdVerification stays false (#97 parked)', () => {
    expect(FEATURES.requireIdVerification).toBe(false);
  });
});
