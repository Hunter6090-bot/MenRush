import { describe, expect, it } from 'vitest';
import {
  groupScreenOverlaps,
  mapPinZIndex,
  shouldShowHotSpotLabel,
  HOTSPOT_LABEL_MIN_ZOOM,
} from './mapPinOverlap';

describe('mapPinOverlap', () => {
  it('hides Hot Spot labels when zoomed out', () => {
    expect(shouldShowHotSpotLabel(HOTSPOT_LABEL_MIN_ZOOM - 0.1)).toBe(false);
    expect(shouldShowHotSpotLabel(HOTSPOT_LABEL_MIN_ZOOM)).toBe(true);
  });

  it('stacks z-index people over empty cruise without moving geography', () => {
    expect(mapPinZIndex('person')).toBeGreaterThan(mapPinZIndex('hotspot', false));
    expect(mapPinZIndex('hotspot', true)).toBeGreaterThan(mapPinZIndex('hotspot', false));
  });

  it('groups near-identical screen piles', () => {
    const groups = groupScreenOverlaps([
      { id: 'a', x: 100, y: 100 },
      { id: 'b', x: 105, y: 102 },
      { id: 'c', x: 400, y: 400 },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.length === 2)?.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });
});
