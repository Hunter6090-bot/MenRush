import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapTopPillBar } from './MapTopPillBar';
import { MapEmptyRadius } from './MapEmptyRadius';
import { loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

const css = readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8');
loadThemeTokens(css);

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
    expect(stack.compareDocumentPosition(pills) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(pills.compareDocumentPosition(below) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Radius / Filters first and scrolls Pulse under them', () => {
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
    expect(screen.getByTestId('map-overlay-scroll').className).toMatch(/overflow-y-auto/);
    expect(column.className).toMatch(/overflow-hidden/);
    expect(leading).toContainElement(screen.getByTestId('pulse-nudge'));
    expect(pills.compareDocumentPosition(leading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('compact empty pill', () => {
  it('is a single 44px / 15px line with Nobody nearby and Widen', () => {
    render(<MapEmptyRadius compact nextRadiusKm={16} onWiden={vi.fn()} />);
    const card = screen.getByTestId('map-empty-radius');
    const widen = screen.getByTestId('map-widen-radius');
    expect(card.textContent).toMatch(/Nobody nearby/);
    expect(card.className).toMatch(/min-h-\[44px\]/);
    expect(card.className).toMatch(/max-w-\[calc\(100%-7\.5rem\)\]/);
    expect(widen.className).toMatch(/min-h-\[44px\]/);
    expect(widen.className).toMatch(/text-\[15px\]/);
    expect(widen.className).toMatch(/bg-\[var\(--copper\)\]/);
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

describe.each(['dark', 'light'] as Theme[])('Widen uses the theme accent (%s)', (theme) => {
  it('fills with --copper and keeps 4.5:1 text on the accent', () => {
    render(<MapEmptyRadius compact nextRadiusKm={10} onWiden={vi.fn()} />);
    const widen = screen.getByTestId('map-widen-radius');
    expect(widen.className).toMatch(/bg-\[var\(--copper\)\]/);
    expect(widen.className).toMatch(/text-\[var\(--nn-on-copper\)\]/);
    expect(widen.className).not.toMatch(/#C4832A|#1A0E03/);
    expect(tokenContrast('var(--nn-on-copper)', 'var(--copper)', theme)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('ThemeToggle label', () => {
  it('uses a full stop, not an em dash', async () => {
    const { ThemeToggle } = await import('./ThemeToggle');
    render(<ThemeToggle />);
    expect(screen.getByText(/theme\. Tap for/)).toBeInTheDocument();
    expect(screen.getByText(/theme\. Tap for/).textContent).not.toMatch(/—/);
  });
});
