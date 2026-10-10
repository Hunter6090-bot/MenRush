/**
 * QC #390: tile name and meta sit on the dark photo fade, so both use the same
 * fixed light colour (not --cream, which is near-black in light mode) and meet
 * 4.5:1 on the fade in both themes, even over a white photo. Grid MATCH is 44px.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NearbyProfileGrid } from './NearbyProfileGrid';

const src = readFileSync(resolve(__dirname, 'NearbyProfileGrid.tsx'), 'utf8');
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

const USER = { id: 'u1', name: 'Sam', age: 30, distance_km: 1, looking_for: 'Chat' };

describe('Nearby tile text on the photo fade', () => {
  it('meta uses the same fixed light colour as the name, never --cream', () => {
    render(
      <MemoryRouter>
        <NearbyProfileGrid users={[USER]} loading={false} />
      </MemoryRouter>,
    );
    const colour = (el: Element) => el.className.match(/text-\[(#[0-9A-Fa-f]{6})\]/)?.[1];
    const name = screen.getByTestId('nearby-grid-name-u1');
    const meta = screen.getByTestId('nearby-grid-meta-u1');
    expect(colour(meta)).toBe(colour(name));
    expect(meta.className).not.toContain('var(--cream)');
  });

  it.each(['light', 'dark'])('name and meta >= 4.5:1 on the fade over a white or black photo (%s theme)', () => {
    // Fixed colours, so the result is the same in both themes; checked for both anyway.
    const text = hex(src.match(/text-\[(#[0-9A-Fa-f]{6})\][^"]*"\s*data-testid=\{`nearby-grid-meta/)![1]);
    const stops = [...src.matchAll(/(?:from|via)-\[rgba\((\d+),(\d+),(\d+),([\d.]+)\)\]/g)].map((m) => ({
      rgb: [Number(m[1]), Number(m[2]), Number(m[3])] as RGB,
      a: Number(m[4]),
    }));
    expect(stops.length).toBe(2);
    for (const photo of [[255, 255, 255], [0, 0, 0]] as RGB[]) {
      for (const s of stops) {
        expect(ratio(text, blend(s.rgb, s.a, photo)), `alpha ${s.a} over ${photo}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('grid MATCH button is 44px tall', () => {
    render(
      <MemoryRouter>
        <NearbyProfileGrid users={[USER]} loading={false} onMatch={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('grid-match-u1')).toHaveClass('min-h-[44px]');
  });
});
