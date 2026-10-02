import { describe, expect, it } from 'vitest';
import {
  looksLikeVerticalMarkerStack,
  markerRootBreaksGeographicPlacement,
  markerStaysAtProjectedPoint,
} from './mapMarkerPlacement';

describe('mapMarkerPlacement (geographic lock)', () => {
  it('flags relative/static marker roots that cause vertical stacks', () => {
    expect(markerRootBreaksGeographicPlacement({ position: 'relative' })).toBe(true);
    expect(markerRootBreaksGeographicPlacement({ position: 'static' })).toBe(true);
    expect(markerRootBreaksGeographicPlacement({ position: 'sticky' })).toBe(true);
    expect(markerRootBreaksGeographicPlacement({ position: 'absolute' })).toBe(false);
    expect(markerRootBreaksGeographicPlacement({ position: '' })).toBe(false);
  });

  it('detects a zoomed-out vertical column (narrow X, tall Y)', () => {
    const stack = [
      { x: 200, y: 100 },
      { x: 202, y: 160 },
      { x: 198, y: 220 },
      { x: 201, y: 280 },
      { x: 199, y: 340 },
    ];
    expect(looksLikeVerticalMarkerStack(stack)).toBe(true);
  });

  it('allows dense geographic overlap (same pixel pile when zoomed out)', () => {
    const pile = [
      { x: 200, y: 180 },
      { x: 201, y: 181 },
      { x: 199, y: 179 },
      { x: 200, y: 180 },
    ];
    expect(looksLikeVerticalMarkerStack(pile)).toBe(false);
  });

  it('allows real geographic spread (wide X and Y)', () => {
    const uk = [
      { x: 120, y: 80 },
      { x: 180, y: 140 },
      { x: 240, y: 200 },
      { x: 90, y: 260 },
    ];
    expect(looksLikeVerticalMarkerStack(uk)).toBe(false);
  });

  it('requires rendered pin to match projected lng/lat pixel', () => {
    expect(markerStaysAtProjectedPoint({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(true);
    expect(markerStaysAtProjectedPoint({ x: 10, y: 20 }, { x: 10, y: 80 })).toBe(false);
  });
});
