import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapTopPillBar } from './MapTopPillBar';

describe('MapTopPillBar stacking', () => {
  it('keeps pills on one nowrap row and stacks layer chrome below (360–430 safe)', () => {
    render(
      <MapTopPillBar
        radiusKm={5}
        onRadiusClick={vi.fn()}
        onFiltersClick={vi.fn()}
      >
        <div data-testid="map-layer-chrome">Layers</div>
      </MapTopPillBar>,
    );

    const stack = screen.getByTestId('map-top-stack');
    const pills = screen.getByTestId('map-top-pill-bar');
    const below = screen.getByTestId('map-top-stack-below');

    expect(stack.className).toMatch(/flex-col/);
    expect(pills.className).toMatch(/flex-nowrap/);
    expect(pills.className).not.toMatch(/flex-wrap/);
    expect(below).toContainElement(screen.getByTestId('map-layer-chrome'));
    // Stack order: pills then below
    expect(stack.compareDocumentPosition(pills) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(pills.compareDocumentPosition(below) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('floats leading chrome above the pills and scrolls inside the map', () => {
    render(
      <MapTopPillBar
        radiusKm={5}
        onRadiusClick={vi.fn()}
        onFiltersClick={vi.fn()}
        leading={<div data-testid="pulse-nudge">Quiet map? Start Pulse</div>}
      >
        <div data-testid="map-layer-chrome">Layers</div>
      </MapTopPillBar>,
    );

    const column = screen.getByTestId('map-overlay-column');
    const leading = screen.getByTestId('map-top-stack-leading');
    const pills = screen.getByTestId('map-top-pill-bar');
    expect(column.className).toMatch(/overflow-y-auto/);
    expect(leading).toContainElement(screen.getByTestId('pulse-nudge'));
    expect(leading.compareDocumentPosition(pills) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Discover quiet-map Pulse card', () => {
  it('stacks the actions under the copy (full-width text, short card)', () => {
    const src = readFileSync(resolve(__dirname, '../pages/Discover.tsx'), 'utf8');
    const card = src.slice(src.indexOf('function QuietMapPulseCard'), src.indexOf('const INJECT_ID'));
    expect(card).toContain('flex flex-col gap-3');
    expect(card).toContain('data-testid="pulse-nudge-actions"');
    expect(card).not.toMatch(/justify-between/);
    expect(card).not.toMatch(/flex-1/);
  });
});
