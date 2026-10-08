/**
 * Pin sheet contrast guard (light and dark).
 * Resolves the sheet's theme-token colour classes against menrush-tokens.css for both
 * themes and asserts WCAG contrast: text >= 4.5:1, icons and the ••• trigger >= 3:1.
 * Also guards that no hardcoded colours remain on the sheet's text, buttons or background.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileDrawer } from './ProfileDrawer';
import type { NearbyUser } from './ProfileCard';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrast, hardcodedColourClasses, loadThemeTokens, type Theme } from '../test/themeContrast';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

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
    // 44x44 invisible hit area; the visible tick keeps its own size.
    expect(screen.getByTestId('verified-tick-hit').className).toMatch(/\bh-11\b.*\bw-11\b/);
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
      expect(contrast(item, theme, { hover: true }), `${item.textContent} hover (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Pin sheet colours follow the theme', () => {
  it('has no hardcoded colour classes on sheet text, buttons or background', () => {
    renderSheet({ liked: true, mutual: true });
    expect(hardcodedColourClasses(screen.getByTestId('pin-sheet'), () => false)).toEqual([]);
    fireEvent.click(screen.getByTestId('pin-sheet-more'));
    const panel = screen.getByTestId('pin-sheet-more-menu');
    // The dimming scrim behind the panel is not part of the sheet surface.
    expect(hardcodedColourClasses(panel, (el) => el.getAttribute('aria-label') === 'Close more')).toEqual([]);
  });
});
