/**
 * Fast-follow contrast guard (QC P1s after #316), light and dark, tokens only:
 * text >= 4.5:1 and icons >= 3:1 for the Out search bar, Nearby Latest chip, You "Still missing"
 * banner and "Active now", and Rooms descriptions.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CruisingSearchBar } from './CruisingSearchBar';
import { NearbySortToggle } from './NearbySortToggle';
import { StatusBadge } from './StatusBadge';
import { RoomList } from './RoomList';
import { contrast, hardcodedColourClasses, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

const getRooms = vi.fn();
vi.mock('../api/client', () => ({
  roomsAPI: { getRooms: (...args: unknown[]) => getRooms(...args), joinRoom: vi.fn() },
}));
vi.mock('../hooks/useSocket', () => ({ useSocket: () => null }));

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
loadThemeTokens(read('../styles/menrush-tokens.css'));

/** Inline style declarations (RoomList styles its rows inline). */
function inline(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (el.getAttribute('style') ?? '').split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

describe.each<Theme>(['light', 'dark'])('redesign contrast (%s)', (theme) => {
  it('Out search bar: label and Outdoor badge >= 4.5:1, icon >= 3:1, no hardcoded colours', () => {
    render(<CruisingSearchBar onOpen={vi.fn()} />);
    const bar = screen.getByTestId('cruising-search-bar');
    expect(hardcodedColourClasses(bar)).toEqual([]);
    expect(contrast(screen.getByText('Search cruising spots…'), theme)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(screen.getByText('Outdoor'), theme)).toBeGreaterThanOrEqual(4.5);
    const icon = bar.querySelector('svg')!.parentElement!;
    expect(contrast(icon, theme)).toBeGreaterThanOrEqual(3);
  });

  it.each(['nearest', 'latest'] as const)('Nearby sort chips (%s active) >= 4.5:1', (mode) => {
    render(<NearbySortToggle mode={mode} onChange={vi.fn()} />);
    const group = screen.getByTestId('nearby-sort-toggle');
    expect(hardcodedColourClasses(group)).toEqual([]);
    for (const id of ['nearest', 'latest']) {
      expect(contrast(screen.getByTestId(`nearby-sort-${id}`), theme), `${id} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('Active now >= 4.5:1 and its dot >= 3:1', () => {
    const { container } = render(<StatusBadge online />);
    const badge = screen.getByText('Active now');
    expect(hardcodedColourClasses(container)).toEqual([]);
    expect(contrast(badge, theme)).toBeGreaterThanOrEqual(4.5);
    expect(tokenContrast('var(--status-online)', 'var(--bg-card)', theme)).toBeGreaterThanOrEqual(3);
  });

  it('Rooms: description, count, Official badge and Join meet contrast', async () => {
    getRooms.mockResolvedValue({
      data: {
        member_rooms: [],
        nearby_rooms: [],
        official_rooms: [
          { id: 'r1', name: 'Bears', description: 'Bears, cubs, otters, chasers', member_count: 0, is_official: true, official_slug: 'bears', user_role: null },
        ],
      },
    });
    render(
      <MemoryRouter>
        <RoomList />
      </MemoryRouter>,
    );
    const desc = await screen.findByText('Bears, cubs, otters, chasers');
    expect(inline(desc).color).toBe('var(--cream-muted)');
    expect(tokenContrast(inline(desc).color, 'var(--bg-card)', theme), `description (${theme})`).toBeGreaterThanOrEqual(4.5);
    const badge = screen.getByText('Official');
    const b = inline(badge);
    expect(tokenContrast(b.color, b.background, theme), `Official (${theme})`).toBeGreaterThanOrEqual(4.5);
    const join = screen.getByTestId('join-official-bears');
    const j = inline(join);
    expect(tokenContrast(j.color, j.background, theme), `Join (${theme})`).toBeGreaterThanOrEqual(4.5);
    await waitFor(() => expect(getRooms).toHaveBeenCalled());
  });

  it('You: Still missing banner follows the theme (>= 4.5:1 text)', () => {
    const src = read('../pages/Profile.tsx');
    const start = src.indexOf('data-testid="profile-missing-essentials-banner"');
    const banner = src.slice(src.lastIndexOf('<div', start), src.indexOf('profile-missing-essentials-list', start) + 400);
    expect(banner).toContain('bg-[var(--bg-card)]');
    expect(banner).not.toMatch(/(?:text|bg|border|decoration)-\[(?:#|rgba?\()/);
    for (const token of ['var(--cream-muted)', 'var(--cream-soft)', 'var(--nn-accent-text)']) {
      expect(banner).toContain(`text-[${token}]`);
      expect(tokenContrast(token, 'var(--bg-card)', theme), `${token} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
