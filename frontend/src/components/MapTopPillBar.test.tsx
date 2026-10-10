import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapTopPillBar } from './MapTopPillBar';
import { MapEmptyRadius } from './MapEmptyRadius';
import { MapPrivacyNote } from './MapPrivacyNote';
import { loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

const css = readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8');
loadThemeTokens(css);

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

function tallColumnRect(): DOMRect {
  return {
    top: 0,
    bottom: 600,
    height: 600,
    left: 0,
    right: 400,
    width: 400,
    x: 0,
    y: 0,
    toJSON() {},
  } as DOMRect;
}

describe('MapTopPillBar stacking', () => {
  it('keeps pills on one nowrap row and orders Pulse, then layers, then spots', () => {
    render(
      <MapTopPillBar
        radiusKm={5}
        onRadiusClick={vi.fn()}
        onFiltersClick={vi.fn()}
        leading={<div data-testid="pulse-nudge">Quiet map? Start Pulse</div>}
        layers={<div data-testid="map-layer-chrome">Layers</div>}
      >
        <div data-testid="hotspots-map-helper">Spots</div>
      </MapTopPillBar>,
    );

    const stack = screen.getByTestId('map-top-stack');
    const pills = screen.getByTestId('map-top-pill-bar');
    const leading = screen.getByTestId('map-top-stack-leading');
    const layerRow = screen.getByTestId('map-top-stack-layers');
    const below = screen.getByTestId('map-top-stack-below');

    expect(stack.className).toMatch(/flex-col/);
    expect(pills.className).toMatch(/flex-nowrap/);
    expect(pills.className).not.toMatch(/flex-wrap/);
    expect(leading).toContainElement(screen.getByTestId('pulse-nudge'));
    expect(layerRow).toContainElement(screen.getByTestId('map-layer-chrome'));
    expect(below).toContainElement(screen.getByTestId('hotspots-map-helper'));
    expect(pills.compareDocumentPosition(leading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(leading.compareDocumentPosition(layerRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(layerRow.compareDocumentPosition(below) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Radius / Filters first and scrolls Pulse under them', () => {
    render(
      <MapTopPillBar
        radiusKm={5}
        onRadiusClick={vi.fn()}
        onFiltersClick={vi.fn()}
        leading={<div data-testid="pulse-nudge">Quiet map? Start Pulse</div>}
        layers={<div data-testid="map-layer-chrome">Layers</div>}
      />,
    );

    const column = screen.getByTestId('map-overlay-column');
    const leading = screen.getByTestId('map-top-stack-leading');
    const pills = screen.getByTestId('map-top-pill-bar');
    expect(screen.getByTestId('map-overlay-scroll').className).toMatch(/overflow-y-auto/);
    expect(column.className).toMatch(/overflow-hidden/);
    expect(leading).toContainElement(screen.getByTestId('pulse-nudge'));
    expect(pills.compareDocumentPosition(leading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const pillSrc = readFileSync(resolve(__dirname, './MapTopPillBar.tsx'), 'utf8');
    expect(pillSrc).toMatch(/via-\[rgba\(240,224,192,0\.22\)\]/);
    expect(pillSrc).toMatch(/\[\[data-theme=light\]_&\]:from-\[#F5EDE0\]/);
    expect(pillSrc).toMatch(/\[\[data-theme=light\]_&\]:via-\[rgba\(184,115,42,0\.22\)\]/);
    expect(pillSrc).not.toMatch(/from-\[var\(--bg-primary\)\]/);
    expect(pillSrc).toMatch(/data-testid="map-overlay-scroll"[\s\S]*map-overlay-scroll-cue/);
  });

  it('puts layer icons on the pills row and skips Pulse on a short map', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.getAttribute('data-testid') === 'map-overlay-column') {
        return { ...tallColumnRect(), bottom: 300, height: 300 };
      }
      return { top: 0, bottom: 0, height: 0, width: 0, left: 0, right: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
    });
    render(
      <MapTopPillBar
        radiusKm={5}
        onRadiusClick={vi.fn()}
        onFiltersClick={vi.fn()}
        leading={<div data-testid="pulse-nudge">Quiet map? Start Pulse</div>}
        layers={<div data-testid="map-layer-chrome">Layers</div>}
        notes={<div data-testid="map-privacy-note">pin</div>}
        spotsNoteText="Map spots include independent venues and outdoor locations. 18+ only."
        pinNoteText="Your pin is moved 80 to 320 m"
      >
        <div data-testid="hotspots-map-helper">Spots</div>
      </MapTopPillBar>,
    );

    expect(screen.getByTestId('map-overlay-column')).toHaveAttribute('data-map-short', 'true');
    expect(screen.queryByTestId('pulse-nudge')).toBeNull();
    expect(screen.queryByTestId('map-overlay-scroll')).toBeNull();
    expect(screen.queryByTestId('map-overlay-scroll-cue')).toBeNull();
    expect(screen.queryByTestId('hotspots-map-helper')).toBeNull();
    expect(screen.queryByTestId('map-privacy-note')).toBeNull();
    expect(screen.getByTestId('map-top-pill-bar')).toContainElement(screen.getByTestId('map-layer-chrome'));
    expect(screen.getByTestId('map-top-pill-bar')).toContainElement(screen.getByTestId('map-short-notes-info'));
    expect(screen.getByTestId('map-short-notes-dot')).toBeInTheDocument();
  });
});

describe('compact empty pill', () => {
  it('says Nobody in this radius at 15px and keeps Widen on the same pill', () => {
    render(<MapEmptyRadius compact nextRadiusKm={16} onWiden={vi.fn()} />);
    const card = screen.getByTestId('map-empty-radius');
    const copy = card.querySelector('span');
    const widen = screen.getByTestId('map-widen-radius');
    expect(card.textContent).toMatch(/Nobody in this radius/);
    expect(copy?.className).toMatch(/text-\[15px\]/);
    expect(copy?.className).not.toMatch(/truncate/);
    expect(card.className).toMatch(/min-h-\[44px\]/);
    expect(card.className).toMatch(/max-w-\[calc\(100%-7\.5rem\)\]/);
    expect(card.className).toMatch(/flex-nowrap/);
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

describe('pin note hit area', () => {
  it('is pointer-events none except the 44px close button', () => {
    render(<MapPrivacyNote text="Your pin is moved 80 to 320 m" />);
    const card = screen.getByTestId('map-privacy-note-card');
    const close = screen.getByTestId('map-privacy-note-close');
    const copy = screen.getByTestId('map-privacy-note');
    expect(card.className).toMatch(/pointer-events-none/);
    expect(close.className).toMatch(/pointer-events-auto/);
    expect(close.className).toMatch(/min-h-\[44px\]/);
    expect(copy.textContent).toBe('Your pin is moved 80 to 320 m');
    expect(copy.className).toMatch(/whitespace-normal/);
    expect(copy.className).not.toMatch(/truncate|line-clamp|text-ellipsis|whitespace-nowrap/);
    expect(card.className).not.toMatch(/max-w-\[220px\]|truncate/);
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
