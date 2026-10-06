import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapTopPillBar } from './MapTopPillBar';

describe('MapTopPillBar stacking', () => {
  it('keeps pills on one nowrap row and stacks Discretion chrome below (360–430 safe)', () => {
    render(
      <MapTopPillBar
        radiusKm={5}
        onRadiusClick={vi.fn()}
        onFiltersClick={vi.fn()}
        onSearchClick={vi.fn()}
      >
        <div data-testid="map-discretion-chrome">Discretion</div>
      </MapTopPillBar>,
    );

    const stack = screen.getByTestId('map-top-stack');
    const pills = screen.getByTestId('map-top-pill-bar');
    const below = screen.getByTestId('map-top-stack-below');

    expect(stack.className).toMatch(/flex-col/);
    expect(pills.className).toMatch(/flex-nowrap/);
    expect(pills.className).not.toMatch(/flex-wrap/);
    expect(below).toContainElement(screen.getByTestId('map-discretion-chrome'));
    // Stack order: pills then below
    expect(stack.compareDocumentPosition(pills) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(pills.compareDocumentPosition(below) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
