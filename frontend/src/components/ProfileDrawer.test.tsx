import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileDrawer } from './ProfileDrawer';
import type { NearbyUser } from './ProfileCard';

vi.mock('../hooks/useMediaQuery', () => ({
  useIsDesktopLayout: () => false,
}));

vi.mock('../hooks/store', () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) =>
    sel({ user: { id: 'viewer-1' } }),
}));

const graham: NearbyUser = {
  id: 'graham-1',
  name: 'Graham',
  age: 46,
  headline: 'Scottish Bear',
  looking_for: 'Casual',
  interests: ['Top', 'Bear', 'Cub', 'Stocky', 'Hairy', 'White'],
  online: false,
  distance_km: 45,
  distance_label: '28 mi',
  photo_url: undefined,
  cover_url: undefined,
};

function renderDrawer() {
  return render(
    <MemoryRouter>
      <ProfileDrawer
        user={graham}
        liked={false}
        onClose={vi.fn()}
        onLike={vi.fn()}
        onPass={vi.fn()}
        onMessage={vi.fn()}
      />
    </MemoryRouter>,
  );
}

function classTokens(el: Element): string[] {
  return Array.from(el.classList);
}

describe('ProfileDrawer grid sheet layout', () => {
  it('keeps the circular avatar outside the scrollport (no mid-face clip)', () => {
    renderDrawer();

    const hero = screen.getByTestId('profile-sheet-hero');
    const avatar = screen.getByTestId('drawer-avatar-graham-1');
    expect(hero).toContainElement(avatar);

    // Avatar must not live under an overflow-y-auto/scroll ancestor — that
    // bisected faces on phone when paired with -mt-* overlap.
    let node: HTMLElement | null = avatar.parentElement;
    while (node && node !== document.body) {
      const tokens = classTokens(node);
      const scrollsY = tokens.some(
        (t) => t === 'overflow-y-auto' || t === 'overflow-y-scroll' || t === 'overflow-auto',
      );
      expect(scrollsY, `avatar ancestor has scroll class: ${tokens.join(' ')}`).toBe(false);
      node = node.parentElement;
    }
  });

  it('shows readable hierarchy: name, status/distance, looking for, interests, actions', () => {
    renderDrawer();

    expect(screen.getByRole('heading', { name: /graham/i })).toBeInTheDocument();
    expect(screen.getByText('46')).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
    expect(screen.getAllByText(/28 mi/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/scottish bear/i)).toBeInTheDocument();
    expect(screen.getByTestId('drawer-looking-for')).toHaveTextContent(/casual/i);
    expect(screen.getByText('Bear')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view full profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^pass$/i })).toBeInTheDocument();
    expect(screen.getByTestId('drawer-match')).toBeInTheDocument();
    expect(screen.getByText(/match is mutual interest/i)).toBeInTheDocument();
  });

  it('places distance in the hero photo band (safe corner), not mid-face bottom', () => {
    renderDrawer();
    const hero = screen.getByTestId('profile-sheet-hero');
    const photoBand = hero.querySelector('[class*="overflow-hidden"]');
    expect(photoBand).toBeTruthy();
    expect(photoBand!.textContent).toMatch(/28 mi/);
  });
});
