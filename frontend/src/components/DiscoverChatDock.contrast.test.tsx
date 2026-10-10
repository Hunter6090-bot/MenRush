/**
 * Map dock (NEARBY · LIVE): theme tokens only, every text 15px or more and
 * >= 4.5:1 in light and dark (also at the lowest fade opacity), and every
 * tappable control at least 44px.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { contrast, hardcodedColourClasses, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

const list = vi.fn();
vi.mock('../api/client', () => ({
  mapFeedAPI: { list: (...a: unknown[]) => list(...a), post: vi.fn(), deleteMessage: vi.fn() },
}));
vi.mock('../hooks/useSocket', () => ({ useSocket: () => null }));
vi.mock('../hooks/store', () => ({
  useAuthStore: () => ({ user: { id: 'u-me', name: 'Me' } }),
  useLocationStore: () => ({ lat: 51.5, lng: -0.12 }),
}));
vi.mock('./FadedBrandFace', () => ({ FadedBrandFace: () => null }));

import { DiscoverChatDock, DOCK_MIN_OPACITY } from './DiscoverChatDock';

Element.prototype.scrollIntoView = vi.fn();
loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));
const source = readFileSync(resolve(__dirname, './DiscoverChatDock.tsx'), 'utf8');

const now = () => new Date().toISOString();
const SIZE = /text-\[(\d+)px\]/;

function fontPx(el: Element): number {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const m = (n.getAttribute('class') ?? '').match(SIZE);
    if (m) return Number(m[1]);
  }
  throw new Error(`no text size for ${el.outerHTML.slice(0, 80)}`);
}

async function renderDock() {
  render(<DiscoverChatDock open onOpenChange={vi.fn()} />);
  await screen.findByTestId('map-dock-bubble-mine');
}

describe('Map dock source', () => {
  it('no hard-coded colours, no text under 15px, no em or en dashes', () => {
    expect(source).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
    expect(source).not.toMatch(/text-\[(?:[0-9]|1[0-4])px\]|\btext-(?:xs|sm|base)\b/);
    expect(source).not.toMatch(/[—–]/);
  });
});

describe.each<Theme>(['light', 'dark'])('Map dock (%s)', (theme) => {
  beforeEach(() => {
    list.mockResolvedValue({
      data: {
        messages: [
          { id: 'm-mine', sender_id: 'u-me', display_name: 'Me', message: 'mine', created_at: now() },
          { id: 'm-other', sender_id: 'u-2', display_name: 'QcNearby', message: 'hello', distance_label: '<1 mi', created_at: now() },
        ],
      },
    });
  });

  it('label, names, times and bubbles are 15px+ and >= 4.5:1', async () => {
    await renderDock();
    expect(hardcodedColourClasses(screen.getByTestId('discover-chat-dock'))).toEqual([]);
    const els: [string, Element][] = [
      ['NEARBY · LIVE label', screen.getByTestId('map-dock-label')],
      ...screen.getAllByTestId('map-dock-name').map((e, i): [string, Element] => [`name ${i}`, e]),
      ...screen.getAllByTestId('map-dock-time').map((e, i): [string, Element] => [`time ${i}`, e]),
      ['my bubble', screen.getByTestId('map-dock-bubble-mine')],
      ['their bubble', screen.getByTestId('map-dock-bubble')],
    ];
    for (const [name, el] of els) {
      expect(fontPx(el), `${name} size`).toBeGreaterThanOrEqual(15);
      expect(contrast(el, theme), `${name} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('message text still >= 4.5:1 at the lowest fade opacity (the header does not fade)', () => {
    const fade = (v: string) => `color-mix(in srgb, ${v} ${DOCK_MIN_OPACITY * 100}%, transparent)`;
    const pairs: [string, string, string][] = [
      ['name', 'var(--cream-muted)', 'var(--bg-card)'],
      ['time', 'var(--text-secondary)', 'var(--bg-card)'],
      ['their bubble', 'var(--cream)', 'var(--bg-elevated)'],
      ['my bubble', 'var(--nn-on-copper)', 'var(--nn-copper)'],
    ];
    for (const [name, fg, bg] of pairs) {
      expect(tokenContrast(fade(fg), fade(bg), theme), `${name} faded (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('empty state is 15px and >= 4.5:1', async () => {
    list.mockResolvedValue({ data: { messages: [] } });
    render(<DiscoverChatDock open onOpenChange={vi.fn()} />);
    const empty = await screen.findByTestId('map-dock-empty');
    expect(fontPx(empty)).toBeGreaterThanOrEqual(15);
    expect(contrast(empty, theme)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Map dock tap targets', () => {
  it('close, send, input, ••• and the collapsed toggle are at least 44px', async () => {
    list.mockResolvedValue({
      data: { messages: [{ id: 'm-mine', sender_id: 'u-me', display_name: 'Me', message: 'mine', created_at: now() }] },
    });
    await renderDock();
    for (const id of ['map-dock-close', 'map-dock-send', 'map-feed-more-m-mine']) {
      expect(screen.getByTestId(id), id).toHaveClass('h-11', 'w-11');
    }
    expect(screen.getByTestId('map-dock-input')).toHaveClass('min-h-[44px]');
  });

  it('collapsed toggle is 44px', () => {
    render(<DiscoverChatDock open={false} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('discover-chat-dock-toggle')).toHaveClass('h-11', 'w-11');
  });
});
