/**
 * Pin sheet contrast guard (light and dark).
 * Resolves the sheet's theme-token colour classes against menrush-tokens.css for both
 * themes and asserts WCAG contrast: text >= 4.5:1, icons and the ••• trigger >= 3:1.
 * Also guards that no hardcoded colours remain on the sheet's text, buttons or background.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileDrawer } from './ProfileDrawer';
import type { NearbyUser } from './ProfileCard';

vi.mock('../hooks/useMediaQuery', () => ({ useIsDesktopLayout: () => false }));
vi.mock('../hooks/store', () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) => sel({ user: { id: 'viewer-1' } }),
}));
vi.mock('../api/client', () => ({
  usersAPI: { blockUser: vi.fn(), reportUser: vi.fn() },
  locationPrivacyAPI: {
    listHidden: vi.fn().mockResolvedValue({ data: { hidden: [], limit: 500 } }),
    hide: vi.fn(),
    unhide: vi.fn(),
  },
}));

const css = readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8');

type Theme = 'dark' | 'light';
type RGBA = [number, number, number, number];

function block(startMarker: string): Record<string, string> {
  const start = css.indexOf(startMarker);
  if (start < 0) throw new Error(`missing ${startMarker}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const ROOT = block(':root {');
const TOKENS: Record<Theme, Record<string, string>> = {
  dark: ROOT,
  light: { ...ROOT, ...block('html.theme-light {') },
};

function resolveVars(value: string, theme: Theme, depth = 0): string {
  if (depth > 12) throw new Error(`var loop: ${value}`);
  const next = value.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, name: string, fb?: string) => {
    const v = TOKENS[theme][name] ?? fb;
    if (v === undefined) throw new Error(`unknown token ${name}`);
    return v;
  });
  return next === value ? value : resolveVars(next, theme, depth + 1);
}

function parseColor(raw: string): RGBA {
  const v = raw.trim();
  if (v === 'transparent') return [0, 0, 0, 0];
  const mix = v.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*transparent\)$/);
  if (mix) {
    const c = parseColor(mix[1]);
    return [c[0], c[1], c[2], c[3] * (Number(mix[2]) / 100)];
  }
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((x) => x + x).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgb = v.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const p = rgb[1].split(',').map((x) => Number(x.trim()));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`unparsed colour ${v}`);
}

const COLOUR_VALUE = /^(var\(|#|rgba?\(|color-mix\()/;

function arbitraryColour(el: Element, prefix: 'text' | 'bg'): string | null {
  for (const cls of (el.getAttribute('class') ?? '').split(/\s+/)) {
    if (cls.includes(':')) continue; // skip hover:, focus-visible: and other variants
    const m = cls.match(new RegExp(`^${prefix}-\\[(.+)\\]$`));
    if (m && COLOUR_VALUE.test(m[1])) return m[1].replace(/_/g, ' ');
  }
  return null;
}

function over(top: RGBA, under: RGBA): RGBA {
  const a = top[3] + under[3] * (1 - top[3]);
  if (a === 0) return [0, 0, 0, 0];
  const ch = (i: number) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
  return [ch(0), ch(1), ch(2), a];
}

function backgroundOf(el: Element, theme: Theme): RGBA {
  const layers: RGBA[] = [];
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = arbitraryColour(n, 'bg');
    if (bg) {
      const c = parseColor(resolveVars(bg, theme));
      layers.push(c);
      if (c[3] >= 1) break;
    }
  }
  if (!layers.length || layers[layers.length - 1][3] < 1) throw new Error('no opaque background');
  return layers.reduceRight<RGBA>((acc, layer) => over(layer, acc), [0, 0, 0, 0]);
}

function foregroundOf(el: Element, theme: Theme): RGBA {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const fg = arbitraryColour(n, 'text');
    if (fg) return parseColor(resolveVars(fg, theme));
  }
  throw new Error(`no text colour for ${el.outerHTML.slice(0, 80)}`);
}

function luminance([r, g, b]: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(el: Element, theme: Theme): number {
  const bg = backgroundOf(el, theme);
  const fg = over(foregroundOf(el, theme), bg);
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const user: NearbyUser & { is_verified: boolean } = {
  id: 'graham-1',
  name: 'Graham',
  age: 46,
  online: true,
  distance_km: 2,
  distance_label: '1 mi',
  is_verified: true,
} as NearbyUser & { is_verified: boolean };

function renderSheet(props: Partial<ComponentProps<typeof ProfileDrawer>> = {}) {
  return render(
    <MemoryRouter>
      <ProfileDrawer user={user} liked={false} onClose={vi.fn()} onLike={vi.fn()} onMessage={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

const HARDCODED = /^(?:[a-z-]+:)*(?:text|bg|border)-\[(?:#|rgba?\()|^(?:[a-z-]+:)*(?:text|bg|border)-(?:white|black)\b/;

function hardcodedIn(root: Element, skip: (el: Element) => boolean): string[] {
  const found: string[] = [];
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    if (skip(el)) continue;
    for (const cls of (el.getAttribute('class') ?? '').split(/\s+/)) {
      if (HARDCODED.test(cls)) found.push(cls);
    }
  }
  return found;
}

describe.each<Theme>(['dark', 'light'])('Pin sheet contrast (%s)', (theme) => {
  it('sheet text >= 4.5:1 and icons >= 3:1', () => {
    renderSheet();
    const sheet = screen.getByTestId('pin-sheet');
    const text: Array<[string, Element]> = [
      ['name', within(sheet).getByRole('heading', { name: 'Graham' })],
      ['age and distance', within(sheet).getByText(/^46/)],
      ['status', screen.getByTestId('pin-sheet-now')],
      ['Profile link', screen.getByTestId('pin-sheet-profile-link')],
      ['Chat', screen.getByTestId('drawer-open-chat')],
      ['Album', screen.getByTestId('pin-sheet-album')],
      ['More', screen.getByTestId('pin-sheet-more')],
    ];
    for (const [label, el] of text) {
      expect(contrast(el, theme), `${label} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(screen.getByTestId('verified-tick'), theme), `verified tick (${theme})`).toBeGreaterThanOrEqual(3);
  });

  it('More panel text, ••• trigger and safety menu rows meet targets', async () => {
    renderSheet({ liked: true, mutual: false });
    fireEvent.click(screen.getByTestId('pin-sheet-more'));
    const panel = screen.getByTestId('pin-sheet-more-menu');
    const helper = within(panel).getByText('Report, Block and Hide my location are in the menu above.');
    const trigger = within(panel).getByRole('button', { name: 'Chat options' });
    expect(contrast(helper, theme), `helper (${theme})`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(within(panel).getByText(/Sent/), theme), `Match row (${theme})`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(screen.getByTestId('pin-sheet-more-cancel'), theme), `Cancel (${theme})`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(trigger, theme), `••• trigger (${theme})`).toBeGreaterThanOrEqual(3);

    fireEvent.click(trigger);
    const menu = await screen.findByRole('menu');
    for (const item of within(menu).getAllByRole('menuitem')) {
      expect(contrast(item, theme), `${item.textContent} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Pin sheet colours follow the theme', () => {
  it('has no hardcoded colour classes on sheet text, buttons or background', () => {
    renderSheet({ liked: true, mutual: true });
    expect(hardcodedIn(screen.getByTestId('pin-sheet'), () => false)).toEqual([]);
    fireEvent.click(screen.getByTestId('pin-sheet-more'));
    const panel = screen.getByTestId('pin-sheet-more-menu');
    // The dimming scrim behind the panel is not part of the sheet surface.
    expect(hardcodedIn(panel, (el) => el.getAttribute('aria-label') === 'Close more')).toEqual([]);
  });
});
