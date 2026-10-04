import { describe, expect, it } from 'vitest';
import { isInUkIreland } from './ukIrelandBounds';

describe('UK + Ireland All region', () => {
  it('includes Manchester, Leeds, Birmingham, London, Dublin, Dover, Jersey', () => {
    expect(isInUkIreland(53.4808, -2.2426)).toBe(true);
    expect(isInUkIreland(53.8008, -1.5491)).toBe(true);
    expect(isInUkIreland(52.4862, -1.8904)).toBe(true);
    expect(isInUkIreland(51.5074, -0.1278)).toBe(true);
    expect(isInUkIreland(53.3498, -6.2603)).toBe(true);
    expect(isInUkIreland(51.1279, 1.3134)).toBe(true);
    expect(isInUkIreland(49.218, -2.127)).toBe(true);
  });

  it('excludes US and northern France', () => {
    expect(isInUkIreland(40.7128, -74.006)).toBe(false);
    expect(isInUkIreland(48.8566, 2.3522)).toBe(false);
    expect(isInUkIreland(34.0522, -118.2437)).toBe(false);
    expect(isInUkIreland(49.6337, -1.6222)).toBe(false); // Cherbourg
    expect(isInUkIreland(49.1829, -0.3707)).toBe(false); // Caen
    expect(isInUkIreland(49.4432, 1.0993)).toBe(false); // Rouen
    expect(isInUkIreland(49.4944, 0.1079)).toBe(false); // Le Havre
    expect(isInUkIreland(49.9216, 1.0775)).toBe(false); // Dieppe
    expect(isInUkIreland(50.7259, 1.6138)).toBe(false); // Boulogne
  });
});
