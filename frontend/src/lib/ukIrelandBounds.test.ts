import { describe, expect, it } from 'vitest';
import { isInUkIreland } from './ukIrelandBounds';

describe('UK + Ireland All region', () => {
  it('includes Manchester, Leeds, Birmingham, London, Dublin', () => {
    expect(isInUkIreland(53.4808, -2.2426)).toBe(true);
    expect(isInUkIreland(53.8008, -1.5491)).toBe(true);
    expect(isInUkIreland(52.4862, -1.8904)).toBe(true);
    expect(isInUkIreland(51.5074, -0.1278)).toBe(true);
    expect(isInUkIreland(53.3498, -6.2603)).toBe(true);
  });

  it('excludes US and other countries', () => {
    expect(isInUkIreland(40.7128, -74.006)).toBe(false);
    expect(isInUkIreland(48.8566, 2.3522)).toBe(false);
    expect(isInUkIreland(34.0522, -118.2437)).toBe(false);
  });
});
