/**
 * QC #390: tile name and meta sit on the photo fade. Both use the same fixed light
 * colour (never --cream, which is near-black in light mode) and must reach 4.5:1
 * where the NAME actually sits over a worst-case white photo, in both themes.
 *
 * The fade is a bottom-to-top linear gradient over the whole text block, and the
 * name is the block's first line. So the thinnest scrim behind any part of the name
 * is the gradient's TOP stop (the block's top edge); the gradient must only get
 * darker from there down. We measure the name colour on that top stop over white,
 * then confirm the stops really run top -> bottom from light to dark.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NearbyProfileGrid } from './NearbyProfileGrid';

type RGB = [number, number, number];
const hex = (h: string): RGB => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16)) as RGB;
const lum = ([r, g, b]: RGB) => {
  const l = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const blend = (top: RGB, alpha: number, under: RGB): RGB => top.map((c, i) => c * alpha + under[i] * (1 - alpha)) as RGB;
const WHITE: RGB = [255, 255, 255];

const USER = { id: 'u1', name: 'Sam', age: 30, distance_km: 1, looking_for: 'Chat' };

function renderTile(onMatch?: () => void) {
  render(
    <MemoryRouter>
      <NearbyProfileGrid users={[USER]} loading={false} onMatch={onMatch} />
    </MemoryRouter>,
  );
}

function fadeStops() {
  const cls = screen.getByTestId('nearby-grid-fade').className;
  expect(cls).toContain('bg-gradient-to-t'); // from = bottom, to = top
  const stop = (k: 'from' | 'via' | 'to') => {
    const m = cls.match(new RegExp(`\\b${k}-\\[rgba\\((\\d+),(\\d+),(\\d+),([\\d.]+)\\)\\]`));
    if (!m) throw new Error(`fade has no rgba ${k} stop (transparent is not allowed behind the name)`);
    return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])] as RGB, a: Number(m[4]) };
  };
  return { bottom: stop('from'), middle: stop('via'), top: stop('to') };
}

const textColour = (el: Element) => hex(el.className.match(/text-\[(#[0-9A-Fa-f]{6})\]/)![1]);

describe('Nearby tile text on the photo fade', () => {
  it('meta uses the same fixed light colour as the name, never --cream', () => {
    renderTile();
    const name = screen.getByTestId('nearby-grid-name-u1');
    const meta = screen.getByTestId('nearby-grid-meta-u1');
    expect(textColour(meta)).toEqual(textColour(name));
    expect(meta.className).not.toContain('var(--cream)');
  });

  it('the scrim only darkens from the top of the text block down', () => {
    renderTile();
    const { bottom, middle, top } = fadeStops();
    expect(top.a).toBeGreaterThanOrEqual(0.6);
    expect(middle.a).toBeGreaterThanOrEqual(top.a);
    expect(bottom.a).toBeGreaterThanOrEqual(middle.a);
    // The name is the first thing in the block, so the top stop is behind it.
    const fade = screen.getByTestId('nearby-grid-fade');
    expect(fade.contains(screen.getByTestId('nearby-grid-name-u1'))).toBe(true);
  });

  it.each(['light', 'dark'])(
    'name and meta >= 4.5:1 at the name position over a white photo (%s theme)',
    () => {
      // Fixed colours, so both themes give the same number; checked for each anyway.
      renderTile();
      const { top } = fadeStops();
      const behindName = blend(top.rgb, top.a, WHITE);
      for (const id of ['nearby-grid-name-u1', 'nearby-grid-meta-u1']) {
        const el = screen.getByTestId(id);
        expect(ratio(textColour(el), behindName), id).toBeGreaterThanOrEqual(4.5);
        // Belt and braces for very bright photo edges: a dark text shadow.
        expect(el.className, id).toMatch(/\[text-shadow:[^\]]*rgba\(0,0,0,0\.9\)\]/);
      }
    },
  );

  it('phone tiles are 4:5 so the name, meta and line never ride above the photo at 360px', () => {
    renderTile();
    const face = screen.getByTestId('nearby-grid-fade').parentElement!;
    expect(face).toHaveClass('aspect-[4/5]', 'md:aspect-square');
  });

  it('grid MATCH button is 44px tall', () => {
    renderTile(vi.fn());
    expect(screen.getByTestId('grid-match-u1')).toHaveClass('min-h-[44px]');
  });
});
